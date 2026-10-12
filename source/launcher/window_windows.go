//go:build windows

package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

// Opens the app in a chromeless window using Microsoft Edge (part of Windows 10 and 11), or Chrome if present.
// A dedicated profile folder keeps it separate from the user's normal browsing.
func openWindow(u string) error {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.TempDir()
	}
	profile := filepath.Join(base, "G-WIZ", "WindowProfile")
	os.MkdirAll(profile, 0o755)
	args := []string{
		"--app=" + u,
		"--user-data-dir=" + profile,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-sync",
		"--window-size=1320,880",
		"--disable-features=msEdgeSidebarV2,msHubApps,msWebAssist,Translate,msImplicitSignin",
	}
	var candidates []string
	for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"} {
		if d := os.Getenv(env); d != "" {
			candidates = append(candidates, filepath.Join(d, "Microsoft", "Edge", "Application", "msedge.exe"))
		}
	}
	for _, env := range []string{"ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"} {
		if d := os.Getenv(env); d != "" {
			candidates = append(candidates, filepath.Join(d, "Google", "Chrome", "Application", "chrome.exe"))
		}
	}
	for _, exe := range candidates {
		if st, err := os.Stat(exe); err == nil && !st.IsDir() {
			cmd := exec.Command(exe, args...)
			if err := cmd.Start(); err == nil {
				go cmd.Wait()
				return nil
			}
		}
	}
	// last resort: the default browser
	if err := exec.Command("rundll32", "url.dll,FileProtocolHandler", u).Start(); err != nil {
		return errors.New("Microsoft Edge was not found and no default browser could be started")
	}
	return nil
}

func showError(msg string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	box := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(msg)
	c, _ := syscall.UTF16PtrFromString("G-WIZ")
	box.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), 0x10) // MB_ICONERROR
}
