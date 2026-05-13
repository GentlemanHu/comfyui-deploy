FROM golang:1.23-bookworm AS builder
WORKDIR /src

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/comfydeploy-go ./cmd/comfydeploy-go

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/comfydeploy-go /app/comfydeploy-go
COPY --from=builder /src/static /app/static
EXPOSE 3000
ENTRYPOINT ["/app/comfydeploy-go"]
