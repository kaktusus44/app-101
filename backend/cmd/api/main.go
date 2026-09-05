package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

type app struct { db *pgxpool.Pool; secureCookie bool }
type identity struct { UserID, OrganizationID, Email, Name, OrganizationName, Role string }
type contextKey string
const identityKey contextKey = "identity"
const sessionCookie = "app101_session"

func main() {
	ctx := context.Background()
	db, err := pgxpool.New(ctx, env("DATABASE_URL", "postgres://app101:app101@localhost:5432/app101?sslmode=disable")); must(err)
	defer db.Close()
	for attempt := 1; ; attempt++ { err = db.Ping(ctx); if err == nil { break }; if attempt == 30 { must(err) }; time.Sleep(time.Second) }
	schema, err := migrationFiles.ReadFile("migrations/001_init.sql"); must(err)
	_, err = db.Exec(ctx, string(schema)); must(err); must(seed(ctx, db))
	a := &app{db: db, secureCookie: env("COOKIE_SECURE", "false") == "true"}
	r := chi.NewRouter(); r.Use(recoverer)
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]string{"status":"ok"}) })
	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/login", a.login); r.Post("/auth/logout", a.logout)
		r.Get("/invitations/{token}", a.getInvitation); r.Post("/invitations/{token}/accept", a.acceptInvitation)
		r.Group(func(r chi.Router) { r.Use(a.authenticate); r.Get("/me", a.me); r.Patch("/me", a.updateMe); r.Get("/counterparties", a.listCounterparties); r.Get("/finance-events", a.listEventHistory); r.Get("/counterparties/{id}/finance-events", a.listFinanceEvents); r.With(requireOrganization).Post("/counterparties", a.createCounterparty); r.With(requireOrganization).Post("/counterparties/{id}/finance-events", a.createFinanceEvent); r.With(requireOrganization).Patch("/finance-events/{id}", a.updateFinanceEvent); r.With(requireOrganization).Delete("/finance-events/{id}", a.deleteFinanceEvent); r.Patch("/finance-events/{id}/status", a.reviewFinanceEvent); r.With(requireOrganization).Post("/invitations", a.createInvitation) })
	})
	addr := env("HTTP_ADDR", ":8080"); slog.Info("api listening", "addr", addr); must(http.ListenAndServe(addr, r))
}

func seed(ctx context.Context, db *pgxpool.Pool) error {
	if _, err := db.Exec(ctx, `UPDATE users SET email=CASE email WHEN 'demo@app101.ru' THEN 'demo@app199.ru' WHEN 'client@app101.ru' THEN 'client@app199.ru' ELSE email END WHERE email IN ('demo@app101.ru','client@app101.ru')`); err != nil { return err }
	var count int; if err := db.QueryRow(ctx, "SELECT count(*) FROM users").Scan(&count); err != nil || count > 0 { return err }
	tx, err := db.Begin(ctx); if err != nil { return err }; defer tx.Rollback(ctx)
	var orgID string; if err = tx.QueryRow(ctx, "INSERT INTO organizations(name) VALUES('КАРГОПЛАСТ') RETURNING id").Scan(&orgID); err != nil { return err }
	for _, u := range []struct{email,name,role string}{{"demo@app199.ru","Администратор","organization"},{"client@app199.ru","Клиент","client"}} {
		hash, _ := bcrypt.GenerateFromPassword([]byte("demo"), bcrypt.DefaultCost); var userID string
		if err = tx.QueryRow(ctx, "INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id", u.email,u.name,string(hash)).Scan(&userID); err != nil { return err }
		if _, err = tx.Exec(ctx, "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,$3)", orgID,userID,u.role); err != nil { return err }
	}
	return tx.Commit(ctx)
}

func (a *app) login(w http.ResponseWriter, r *http.Request) {
	var in struct{ Email, Password string }; if !decode(w,r,&in) { return }
	var id identity; var passwordHash string
	err := a.db.QueryRow(r.Context(), `SELECT u.id,u.email,u.name,u.password_hash,o.id,o.name,m.role FROM users u JOIN organization_members m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id WHERE lower(u.email)=lower($1)`, strings.TrimSpace(in.Email)).Scan(&id.UserID,&id.Email,&id.Name,&passwordHash,&id.OrganizationID,&id.OrganizationName,&id.Role)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(in.Password)) != nil { problem(w,401,"Неверный логин или пароль"); return }
	if err = a.newSession(r.Context(),w,id.UserID); err != nil { problem(w,500,"Не удалось создать сессию"); return }; writeJSON(w,200,userResponse(id))
}
func (a *app) logout(w http.ResponseWriter, r *http.Request) { if c,err:=r.Cookie(sessionCookie); err==nil { h:=sha256.Sum256([]byte(c.Value)); _,_=a.db.Exec(r.Context(),"DELETE FROM sessions WHERE token_hash=$1",h[:]) }; a.clearCookie(w); w.WriteHeader(204) }
func (a *app) me(w http.ResponseWriter, r *http.Request) { writeJSON(w,200,userResponse(current(r))) }
func (a *app) updateMe(w http.ResponseWriter, r *http.Request) {
	id:=current(r); var in struct{Name,Email,OrganizationName string}; if !decode(w,r,&in){return}; in.Name=strings.TrimSpace(in.Name); in.Email=strings.TrimSpace(in.Email); in.OrganizationName=strings.TrimSpace(in.OrganizationName)
	if in.Name==""||in.Email==""{problem(w,400,"Имя и email обязательны");return}
	tx,err:=a.db.Begin(r.Context());if err!=nil{problem(w,500,"Ошибка базы данных");return};defer tx.Rollback(r.Context())
	if _,err=tx.Exec(r.Context(),"UPDATE users SET name=$1,email=$2,updated_at=now() WHERE id=$3",in.Name,in.Email,id.UserID);err!=nil{problem(w,409,"Этот email уже используется");return}
	if id.Role=="organization"&&in.OrganizationName!=""{if _,err=tx.Exec(r.Context(),"UPDATE organizations SET name=$1,updated_at=now() WHERE id=$2",in.OrganizationName,id.OrganizationID);err!=nil{problem(w,500,"Не удалось обновить организацию");return};id.OrganizationName=in.OrganizationName}
	if err=tx.Commit(r.Context());err!=nil{problem(w,500,"Не удалось сохранить профиль");return};id.Name=in.Name;id.Email=in.Email;writeJSON(w,200,userResponse(id))
}

func (a *app) createInvitation(w http.ResponseWriter, r *http.Request) {
	id:=current(r);var in struct{Name,Email,Password,Category string};if !decode(w,r,&in){return};in.Name=strings.TrimSpace(in.Name);in.Email=strings.TrimSpace(in.Email)
	if in.Name==""||in.Email==""||len(in.Password)<8||!validCategory(in.Category){problem(w,400,"Проверьте имя, email, категорию и пароль");return}
	token:=randomToken();tokenHash:=sha256.Sum256([]byte(token));passwordHash,_:=bcrypt.GenerateFromPassword([]byte(in.Password),bcrypt.DefaultCost);var created,expires time.Time
	err:=a.db.QueryRow(r.Context(),`INSERT INTO invitations(organization_id,created_by,name,email,password_hash,category,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '7 days') RETURNING created_at,expires_at`,id.OrganizationID,id.UserID,in.Name,in.Email,string(passwordHash),in.Category,tokenHash[:]).Scan(&created,&expires)
	if err!=nil{problem(w,500,"Не удалось создать приглашение");return};writeJSON(w,201,map[string]any{"token":token,"name":in.Name,"login":in.Email,"category":in.Category,"organizationName":id.OrganizationName,"createdAt":created,"expiresAt":expires})
}
func (a *app) getInvitation(w http.ResponseWriter,r *http.Request){
	h:=sha256.Sum256([]byte(chi.URLParam(r,"token")));var name,email,category,org string;var expires time.Time
	err:=a.db.QueryRow(r.Context(),`SELECT i.name,i.email,i.category,o.name,i.expires_at FROM invitations i JOIN organizations o ON o.id=i.organization_id WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now()`,h[:]).Scan(&name,&email,&category,&org,&expires)
	if err!=nil{problem(w,404,"Приглашение недействительно или истекло");return};writeJSON(w,200,map[string]any{"name":name,"login":email,"category":category,"organizationName":org,"expiresAt":expires})
}
func (a *app) acceptInvitation(w http.ResponseWriter,r *http.Request){
	var in struct{Email,Password string};if !decode(w,r,&in){return};h:=sha256.Sum256([]byte(chi.URLParam(r,"token")));tx,err:=a.db.Begin(r.Context());if err!=nil{problem(w,500,"Ошибка базы данных");return};defer tx.Rollback(r.Context())
	var invitationID,orgID,name,email,passwordHash,category string;err=tx.QueryRow(r.Context(),`SELECT id,organization_id,name,email,password_hash,category FROM invitations WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE`,h[:]).Scan(&invitationID,&orgID,&name,&email,&passwordHash,&category)
	if err!=nil{problem(w,404,"Приглашение недействительно или истекло");return};if !strings.EqualFold(strings.TrimSpace(in.Email),email)||bcrypt.CompareHashAndPassword([]byte(passwordHash),[]byte(in.Password))!=nil{problem(w,401,"Неверный логин или временный пароль");return}
	var userID string;err=tx.QueryRow(r.Context(),"SELECT id FROM users WHERE lower(email)=lower($1)",email).Scan(&userID)
	if err==pgx.ErrNoRows{err=tx.QueryRow(r.Context(),"INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id",email,name,passwordHash).Scan(&userID)}
	if err!=nil{problem(w,409,"Не удалось создать пользователя");return};_,err=tx.Exec(r.Context(),`INSERT INTO organization_members(organization_id,user_id,role,category) VALUES($1,$2,'client',$3) ON CONFLICT DO NOTHING`,orgID,userID,category);if err!=nil{problem(w,500,"Не удалось назначить роль");return}
	_,err=tx.Exec(r.Context(),"UPDATE invitations SET accepted_at=now() WHERE id=$1",invitationID);if err!=nil||tx.Commit(r.Context())!=nil{problem(w,500,"Не удалось принять приглашение");return}
	if err=a.newSession(r.Context(),w,userID);err!=nil{problem(w,500,"Не удалось создать сессию");return};var id identity;if a.loadIdentity(r.Context(),userID,&id)!=nil{problem(w,500,"Не удалось загрузить профиль");return};writeJSON(w,200,userResponse(id))
}
func (a *app) createCounterparty(w http.ResponseWriter,r *http.Request){id:=current(r);var in struct{Name,Category,Phone,Email string};if !decode(w,r,&in){return};in.Name=strings.TrimSpace(in.Name);if in.Name==""||!validCategory(in.Category){problem(w,400,"Укажите имя и категорию");return};var counterpartyID string;err:=a.db.QueryRow(r.Context(),`INSERT INTO counterparties(organization_id,name,category,phone,email) VALUES($1,$2,$3,$4,$5) RETURNING id`,id.OrganizationID,in.Name,in.Category,strings.TrimSpace(in.Phone),strings.TrimSpace(in.Email)).Scan(&counterpartyID);if err!=nil{problem(w,500,"Не удалось создать контрагента");return};writeJSON(w,201,map[string]any{"id":counterpartyID,"name":in.Name,"category":in.Category,"phone":strings.TrimSpace(in.Phone),"email":strings.TrimSpace(in.Email),"invited":false})}
func (a *app) listCounterparties(w http.ResponseWriter,r *http.Request){id:=current(r);rows,err:=a.db.Query(r.Context(),`SELECT id,name,category,email,phone,false,false,created_at FROM counterparties WHERE organization_id=$1 UNION ALL SELECT id,name,category,email,'',true,(accepted_at IS NOT NULL),created_at FROM invitations WHERE organization_id=$1 ORDER BY created_at DESC`,id.OrganizationID);if err!=nil{problem(w,500,"Не удалось загрузить контрагентов");return};defer rows.Close();result:=[]map[string]any{};for rows.Next(){var cid,name,category,email,phone string;var invited,accepted bool;var created time.Time;_ = rows.Scan(&cid,&name,&category,&email,&phone,&invited,&accepted,&created);result=append(result,map[string]any{"id":cid,"name":name,"category":category,"email":email,"phone":phone,"invited":invited,"accepted":accepted,"createdAt":created})};writeJSON(w,200,result)}

func (a *app) createFinanceEvent(w http.ResponseWriter,r *http.Request){
	id:=current(r);counterpartyID:=chi.URLParam(r,"id");var in struct{Type string;Amount,SecondaryAmount float64;ProjectID,ProjectName,Description,EventDate,AttachmentURL,ReceiptDestination,Tag,RelatedPartyID,RelatedPartyName,TransferKind,EstimateDestination,ExpenseCategory,EstimatePositions string};if !decode(w,r,&in){return}
	if !validFinanceType(in.Type)||in.Amount<0{problem(w,400,"Проверьте тип операции и сумму");return};if in.EventDate==""{in.EventDate=time.Now().Format("2006-01-02")};if in.ReceiptDestination==""{in.ReceiptDestination="project"}
	if in.Type=="receipt"&&!validReceiptDestination(in.ReceiptDestination){problem(w,400,"Выберите раздел поступления");return};if in.Type=="receipt"&&in.ReceiptDestination=="project"&&strings.TrimSpace(in.ProjectID)==""{problem(w,400,"Для поступления по проекту выберите проект");return};if in.Type!="receipt"{in.ReceiptDestination=""}
	if in.Type=="receipt"&&in.ReceiptDestination!="company_fund"&&strings.TrimSpace(in.RelatedPartyID)==""{problem(w,400,"Выберите заказчика или плательщика");return};if in.Type=="transfer"&&(!validTransferKind(in.TransferKind)||strings.TrimSpace(in.RelatedPartyID)==""){problem(w,400,"Выберите тип перевода и получателя");return};if in.Type!="receipt"&&in.Type!="transfer"||in.Type=="receipt"&&in.ReceiptDestination=="company_fund"{in.RelatedPartyID="";in.RelatedPartyName=""};if in.Type!="transfer"{in.TransferKind=""}
	if in.Type=="estimate" { if in.EstimateDestination!="project"&&in.EstimateDestination!="company_fund" { problem(w,400,"Выберите раздел сметы");return }; if in.EstimateDestination=="project"&&strings.TrimSpace(in.ProjectID)=="" { problem(w,400,"Выберите проект");return }; if in.EstimateDestination=="company_fund" { in.ProjectID="";in.ProjectName="" } } else { in.EstimateDestination="";in.SecondaryAmount=0;in.ExpenseCategory="";in.EstimatePositions="" }
	_,_=a.db.Exec(r.Context(),`DELETE FROM finance_events WHERE organization_id=$1 AND event_date<current_date-interval '3 years'`,id.OrganizationID)
	var eventID string;err:=a.db.QueryRow(r.Context(),`INSERT INTO finance_events(organization_id,counterparty_id,event_type,amount,project_id,project_name,description,event_date,attachment_url,receipt_destination,tag,related_party_id,related_party_name,transfer_kind,estimate_destination,secondary_amount,expense_category,estimate_positions,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,id.OrganizationID,counterpartyID,in.Type,in.Amount,in.ProjectID,strings.TrimSpace(in.ProjectName),strings.TrimSpace(in.Description),in.EventDate,strings.TrimSpace(in.AttachmentURL),in.ReceiptDestination,strings.TrimSpace(in.Tag),strings.TrimSpace(in.RelatedPartyID),strings.TrimSpace(in.RelatedPartyName),in.TransferKind,in.EstimateDestination,in.SecondaryAmount,strings.TrimSpace(in.ExpenseCategory),strings.TrimSpace(in.EstimatePositions),id.UserID).Scan(&eventID)
	if err!=nil{problem(w,400,"Не удалось создать финансовое событие");return};writeJSON(w,201,map[string]string{"id":eventID})
}
func (a *app) listFinanceEvents(w http.ResponseWriter,r *http.Request){
	id:=current(r);counterpartyID:=chi.URLParam(r,"id");if id.Role=="client"{var allowed bool;_ = a.db.QueryRow(r.Context(),`SELECT EXISTS(SELECT 1 FROM invitations WHERE id=$1 AND organization_id=$2 AND lower(email)=lower($3) AND accepted_at IS NOT NULL)`,counterpartyID,id.OrganizationID,id.Email).Scan(&allowed);if !allowed{problem(w,403,"Недостаточно прав");return}}
	rows,err:=a.db.Query(r.Context(),`SELECT e.id,e.event_type,e.amount,e.status,e.project_id,e.project_name,e.description,e.event_date,e.attachment_url,e.receipt_destination,e.tag,e.related_party_id,e.related_party_name,e.transfer_kind,e.created_at,u.name FROM finance_events e JOIN users u ON u.id=e.created_by WHERE e.organization_id=$1 AND e.counterparty_id=$2 ORDER BY e.created_at DESC`,id.OrganizationID,counterpartyID);if err!=nil{problem(w,400,"Не удалось загрузить события");return};defer rows.Close()
	events:=[]map[string]any{};var balance,received,spent float64;for rows.Next(){var eventID,eventType,status,projectID,projectName,description,attachmentURL,receiptDestination,tag,relatedPartyID,relatedPartyName,transferKind,creator string;var amount float64;var eventDate,created time.Time;if err=rows.Scan(&eventID,&eventType,&amount,&status,&projectID,&projectName,&description,&eventDate,&attachmentURL,&receiptDestination,&tag,&relatedPartyID,&relatedPartyName,&transferKind,&created,&creator);err!=nil{problem(w,500,"Не удалось прочитать финансовое событие");return};events=append(events,map[string]any{"id":eventID,"type":eventType,"amount":amount,"status":status,"projectId":projectID,"projectName":projectName,"description":description,"eventDate":eventDate.Format("2006-01-02"),"attachmentUrl":attachmentURL,"receiptDestination":receiptDestination,"tag":tag,"relatedPartyId":relatedPartyID,"relatedPartyName":relatedPartyName,"transferKind":transferKind,"createdAt":created,"createdBy":creator});if status=="confirmed"{switch eventType{case"receipt":received+=amount;balance+=amount;case"report","transfer":spent+=amount;balance-=amount}}};writeJSON(w,200,map[string]any{"events":events,"balance":balance,"received":received,"spent":spent})
}
func (a *app) listEventHistory(w http.ResponseWriter,r *http.Request){
	id:=current(r);query:=`SELECT e.id,e.counterparty_id,COALESCE(c.name,i.name,owner.name,'Контрагент'),e.event_type,e.amount,e.status,e.project_id,e.project_name,e.description,e.event_date,e.attachment_url,e.receipt_destination,e.tag,e.related_party_id,e.related_party_name,e.transfer_kind,e.created_at,u.name FROM finance_events e JOIN users u ON u.id=e.created_by LEFT JOIN counterparties c ON c.id=e.counterparty_id LEFT JOIN invitations i ON i.id=e.counterparty_id LEFT JOIN users owner ON owner.id=e.counterparty_id WHERE e.organization_id=$1 AND e.event_date>=current_date-interval '3 years'`
	args:=[]any{id.OrganizationID};if id.Role=="client"{query+=` AND EXISTS(SELECT 1 FROM invitations mine WHERE mine.id=e.counterparty_id AND lower(mine.email)=lower($2) AND mine.accepted_at IS NOT NULL)`;args=append(args,id.Email)};query+=` ORDER BY e.event_date DESC,e.created_at DESC LIMIT 5000`
	rows,err:=a.db.Query(r.Context(),query,args...);if err!=nil{problem(w,500,"Не удалось загрузить историю");return};defer rows.Close();events:=[]map[string]any{}
	for rows.Next(){var eventID,counterpartyID,counterpartyName,eventType,status,projectID,projectName,description,attachmentURL,receiptDestination,tag,relatedPartyID,relatedPartyName,transferKind,creator string;var amount float64;var eventDate,created time.Time;if err=rows.Scan(&eventID,&counterpartyID,&counterpartyName,&eventType,&amount,&status,&projectID,&projectName,&description,&eventDate,&attachmentURL,&receiptDestination,&tag,&relatedPartyID,&relatedPartyName,&transferKind,&created,&creator);err!=nil{problem(w,500,"Не удалось прочитать историю");return};events=append(events,map[string]any{"id":eventID,"counterpartyId":counterpartyID,"counterpartyName":counterpartyName,"type":eventType,"amount":amount,"status":status,"projectId":projectID,"projectName":projectName,"description":description,"eventDate":eventDate.Format("2006-01-02"),"attachmentUrl":attachmentURL,"receiptDestination":receiptDestination,"tag":tag,"relatedPartyId":relatedPartyID,"relatedPartyName":relatedPartyName,"transferKind":transferKind,"createdAt":created,"createdBy":creator})};writeJSON(w,200,map[string]any{"events":events,"retentionMonths":36,"limit":5000})
}
func (a *app) updateFinanceEvent(w http.ResponseWriter,r *http.Request){
	id:=current(r);eventID:=chi.URLParam(r,"id");var in struct{Type string;Amount float64;ProjectID,ProjectName,Description,EventDate,AttachmentURL,ReceiptDestination,Tag,RelatedPartyID,RelatedPartyName,TransferKind string};if !decode(w,r,&in){return}
	if !validFinanceType(in.Type)||in.Amount<0{problem(w,400,"Проверьте тип операции и сумму");return};if in.EventDate==""{problem(w,400,"Укажите дату");return};if in.Type=="receipt"&&!validReceiptDestination(in.ReceiptDestination){problem(w,400,"Выберите раздел поступления");return};if in.Type=="receipt"&&in.ReceiptDestination=="project"&&strings.TrimSpace(in.ProjectID)==""{problem(w,400,"Выберите проект");return};if in.Type=="receipt"&&in.ReceiptDestination!="company_fund"&&strings.TrimSpace(in.RelatedPartyID)==""{problem(w,400,"Выберите заказчика или плательщика");return};if in.Type=="transfer"&&(!validTransferKind(in.TransferKind)||strings.TrimSpace(in.RelatedPartyID)==""){problem(w,400,"Выберите тип перевода и получателя");return};if in.Type!="receipt"{in.ReceiptDestination=""};if in.Type!="receipt"&&in.Type!="transfer"||in.Type=="receipt"&&in.ReceiptDestination=="company_fund"{in.RelatedPartyID="";in.RelatedPartyName=""};if in.Type!="transfer"{in.TransferKind=""}
	result,err:=a.db.Exec(r.Context(),`UPDATE finance_events SET event_type=$1,amount=$2,project_id=$3,project_name=$4,description=$5,event_date=$6,attachment_url=$7,receipt_destination=$8,tag=$9,related_party_id=$10,related_party_name=$11,transfer_kind=$12,updated_at=now() WHERE id=$13 AND organization_id=$14`,in.Type,in.Amount,in.ProjectID,strings.TrimSpace(in.ProjectName),strings.TrimSpace(in.Description),in.EventDate,strings.TrimSpace(in.AttachmentURL),in.ReceiptDestination,strings.TrimSpace(in.Tag),strings.TrimSpace(in.RelatedPartyID),strings.TrimSpace(in.RelatedPartyName),in.TransferKind,eventID,id.OrganizationID);if err!=nil{problem(w,400,"Не удалось изменить событие");return};if result.RowsAffected()==0{problem(w,404,"Событие не найдено");return};writeJSON(w,200,map[string]string{"id":eventID})
}
func (a *app) deleteFinanceEvent(w http.ResponseWriter,r *http.Request){id:=current(r);result,err:=a.db.Exec(r.Context(),`DELETE FROM finance_events WHERE id=$1 AND organization_id=$2`,chi.URLParam(r,"id"),id.OrganizationID);if err!=nil{problem(w,500,"Не удалось удалить событие");return};if result.RowsAffected()==0{problem(w,404,"Событие не найдено");return};w.WriteHeader(http.StatusNoContent)}
func (a *app) reviewFinanceEvent(w http.ResponseWriter,r *http.Request){
	id:=current(r);var in struct{Status string};if !decode(w,r,&in){return};if in.Status!="confirmed"&&in.Status!="rejected"{problem(w,400,"Доступны подтверждение или отклонение");return}
	eventID:=chi.URLParam(r,"id");var counterpartyID string;err:=a.db.QueryRow(r.Context(),`SELECT counterparty_id FROM finance_events WHERE id=$1 AND organization_id=$2 AND status='pending'`,eventID,id.OrganizationID).Scan(&counterpartyID);if err!=nil{problem(w,404,"Событие не найдено или уже обработано");return}
	if id.Role=="client"{var allowed bool;_ = a.db.QueryRow(r.Context(),`SELECT EXISTS(SELECT 1 FROM invitations WHERE id=$1 AND lower(email)=lower($2) AND accepted_at IS NOT NULL)`,counterpartyID,id.Email).Scan(&allowed);if !allowed{problem(w,403,"Недостаточно прав");return}}
	_,err=a.db.Exec(r.Context(),`UPDATE finance_events SET status=$1,reviewed_by=$2,reviewed_at=now(),updated_at=now() WHERE id=$3`,in.Status,id.UserID,eventID);if err!=nil{problem(w,500,"Не удалось обработать событие");return};writeJSON(w,200,map[string]string{"status":in.Status})
}

func (a *app) authenticate(next http.Handler)http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){c,err:=r.Cookie(sessionCookie);if err!=nil{problem(w,401,"Требуется вход");return};h:=sha256.Sum256([]byte(c.Value));var id identity;err=a.db.QueryRow(r.Context(),`SELECT u.id,u.email,u.name,o.id,o.name,m.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN organization_members m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id WHERE s.token_hash=$1 AND s.expires_at>now()`,h[:]).Scan(&id.UserID,&id.Email,&id.Name,&id.OrganizationID,&id.OrganizationName,&id.Role);if err!=nil{a.clearCookie(w);problem(w,401,"Сессия истекла");return};next.ServeHTTP(w,r.WithContext(context.WithValue(r.Context(),identityKey,id)))})}
func requireOrganization(next http.Handler)http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){if current(r).Role!="organization"{problem(w,403,"Недостаточно прав");return};next.ServeHTTP(w,r)})}
func (a *app) newSession(ctx context.Context,w http.ResponseWriter,userID string)error{token:=randomToken();h:=sha256.Sum256([]byte(token));expires:=time.Now().Add(30*24*time.Hour);_,err:=a.db.Exec(ctx,"INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)",userID,h[:],expires);if err==nil{http.SetCookie(w,&http.Cookie{Name:sessionCookie,Value:token,Path:"/",HttpOnly:true,Secure:a.secureCookie,SameSite:http.SameSiteLaxMode,Expires:expires,MaxAge:2592000})};return err}
func (a *app) clearCookie(w http.ResponseWriter){http.SetCookie(w,&http.Cookie{Name:sessionCookie,Path:"/",HttpOnly:true,Secure:a.secureCookie,SameSite:http.SameSiteLaxMode,MaxAge:-1})}
func (a *app) loadIdentity(ctx context.Context,userID string,id *identity)error{return a.db.QueryRow(ctx,`SELECT u.id,u.email,u.name,o.id,o.name,m.role FROM users u JOIN organization_members m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id WHERE u.id=$1`,userID).Scan(&id.UserID,&id.Email,&id.Name,&id.OrganizationID,&id.OrganizationName,&id.Role)}
func current(r *http.Request)identity{return r.Context().Value(identityKey).(identity)}
func userResponse(i identity)map[string]string{return map[string]string{"id":i.UserID,"email":i.Email,"name":i.Name,"organizationId":i.OrganizationID,"organizationName":i.OrganizationName,"role":i.Role}}
func randomToken()string{b:=make([]byte,32);if _,err:=rand.Read(b);err!=nil{panic(err)};return base64.RawURLEncoding.EncodeToString(b)}
func validCategory(v string)bool{switch v{case "customer","partner","contractor","supplier","employee":return true};return false}
func validFinanceType(v string)bool{switch v{case "receipt","report","transfer","estimate":return true};return false}
func validReceiptDestination(v string)bool{switch v{case "project","agent_fee","company_fund":return true};return false}
func validTransferKind(v string)bool{switch v{case "project_payment","project_accountable","fund_payment","project_to_fund","fund_to_project":return true};return false}
func decode(w http.ResponseWriter,r *http.Request,v any)bool{r.Body=http.MaxBytesReader(w,r.Body,1<<20);decoder:=json.NewDecoder(r.Body);decoder.DisallowUnknownFields();if err:=decoder.Decode(v);err!=nil{problem(w,400,"Некорректный запрос");return false};return true}
func writeJSON(w http.ResponseWriter,status int,v any){w.Header().Set("Content-Type","application/json; charset=utf-8");w.WriteHeader(status);_ = json.NewEncoder(w).Encode(v)}
func problem(w http.ResponseWriter,status int,message string){writeJSON(w,status,map[string]string{"error":message})}
func recoverer(next http.Handler)http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){defer func(){if value:=recover();value!=nil{slog.Error("panic","error",fmt.Sprint(value));problem(w,500,"Внутренняя ошибка")}}();next.ServeHTTP(w,r)})}
func env(key,fallback string)string{if value:=os.Getenv(key);value!=""{return value};return fallback}
func must(err error){if err!=nil{panic(err)}}
