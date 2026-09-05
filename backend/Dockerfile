FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app101-api ./cmd/api

FROM alpine:3.21
RUN adduser -D -u 10001 app
USER app
COPY --from=build /app101-api /app101-api
EXPOSE 8080
ENTRYPOINT ["/app101-api"]
