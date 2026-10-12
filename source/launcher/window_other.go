//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

// Non-Windows builds are for development: open the default browser, or print the address.
func openWindow(u string) error {
	if os.Getenv("GWIZ_NO_BROWSER") != "" {
		fmt.Println("G-WIZ serving at", u)
		return nil
	}
	if runtime.GOOS == "darwin" {
		return exec.Command("open", u).Start()
	}
	return exec.Command("xdg-open", u).Start()
}

func showError(msg string) { fmt.Fprintln(os.Stderr, msg) }
