// G-WIZ launcher: serves the embedded app on 127.0.0.1 and opens it in its own app window
// (Microsoft Edge app mode on Windows, no tabs or address bar). The launcher exits when the window closes.
package main

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

//go:embed index.html
var indexHTML []byte

const version = "1.8.0"

type launcher struct {
	token    string
	initial  string
	mu       sync.Mutex
	gotPing  bool
	lastPing time.Time
	byeAt    time.Time
	quit     chan struct{}
	once     sync.Once
}

func main() {
	l := &launcher{token: randToken(), quit: make(chan struct{})}
	if len(os.Args) > 1 {
		if p, err := filepath.Abs(os.Args[1]); err == nil {
			if st, err := os.Stat(p); err == nil && !st.IsDir() {
				l.initial = p
			}
		}
	}
	ln, err := listen()
	if err != nil {
		showError("G-WIZ could not start its local window server.\n\n" + err.Error())
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	mux := http.NewServeMux()
	mux.HandleFunc("/", l.index)
	mux.HandleFunc("/api/ping", l.api(func(w http.ResponseWriter, r *http.Request) { l.touch(); w.WriteHeader(204) }))
	mux.HandleFunc("/api/bye", l.api(func(w http.ResponseWriter, r *http.Request) {
		l.mu.Lock(); l.byeAt = time.Now(); l.mu.Unlock(); w.WriteHeader(204)
	}))
	mux.HandleFunc("/api/quit", l.api(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(204)
		go func() { time.Sleep(600 * time.Millisecond); l.stop() }()
	}))
	mux.HandleFunc("/api/initial", l.api(l.serveInitial))
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	go srv.Serve(ln)

	u := fmt.Sprintf("http://127.0.0.1:%d/", port)
	if err := openWindow(u); err != nil {
		showError("G-WIZ could not open its window.\n\n" + err.Error() + "\n\nOpen this address in a browser instead:\n" + u)
	}
	l.watch()
	srv.Close()
}

// A fixed port keeps the app's origin stable between runs; fall back to any free port.
func listen() (net.Listener, error) {
	for p := 47811; p < 47831; p++ {
		if ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p)); err == nil {
			return ln, nil
		}
	}
	return net.Listen("tcp", "127.0.0.1:0")
}

func randToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func localHost(r *http.Request) bool {
	h := r.Host
	return strings.HasPrefix(h, "127.0.0.1:") || strings.HasPrefix(h, "localhost:")
}

func (l *launcher) index(w http.ResponseWriter, r *http.Request) {
	if !localHost(r) || (r.URL.Path != "/" && r.URL.Path != "/index.html") {
		http.NotFound(w, r)
		return
	}
	boot, _ := json.Marshal(map[string]any{"token": l.token, "version": version, "initial": l.initial != ""})
	page := strings.Replace(string(indexHTML), "/*__GWIZ_BOOT__*/", "window.__GWIZ__="+string(boot)+";", 1)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write([]byte(page))
}

func (l *launcher) api(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !localHost(r) || r.URL.Query().Get("t") != l.token {
			http.Error(w, "forbidden", 403)
			return
		}
		h(w, r)
	}
}

func (l *launcher) serveInitial(w http.ResponseWriter, r *http.Request) {
	if l.initial == "" {
		w.WriteHeader(204)
		return
	}
	data, err := os.ReadFile(l.initial)
	if err != nil {
		http.Error(w, err.Error(), 404)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-File-Name", url.PathEscape(filepath.Base(l.initial)))
	w.Write(data)
}

func (l *launcher) touch() {
	l.mu.Lock()
	l.gotPing = true
	l.lastPing = time.Now()
	l.mu.Unlock()
}

func (l *launcher) stop() { l.once.Do(func() { close(l.quit) }) }

// Exit when the window stops checking in: shortly after it says goodbye, or after a longer silence.
func (l *launcher) watch() {
	start := time.Now()
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for {
		select {
		case <-l.quit:
			return
		case <-t.C:
			l.mu.Lock()
			got, last, bye := l.gotPing, l.lastPing, l.byeAt
			l.mu.Unlock()
			now := time.Now()
			if !got && now.Sub(start) > 120*time.Second {
				return
			}
			if got && bye.After(last) && now.Sub(bye) > 4*time.Second {
				return
			}
			if got && now.Sub(last) > 15*time.Second {
				return
			}
		}
	}
}
