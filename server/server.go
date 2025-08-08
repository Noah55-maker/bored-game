/**
 * TODO
 * - functionality to create separate games with their own players
 * - give messages IDs to match responses with requests
 * - safe message parsing (avoid crashing with bad requests)
 */

package main

import (
	"context"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"
)

func main() {
	address := "localhost:1234"
	http.HandleFunc("/echo", echoHandler)
	log.Printf("Starting server, go to http://%s/ to try it out!", address)
	err := http.ListenAndServe(address, nil)
	log.Fatal(err)
}

func echoHandler(w http.ResponseWriter, r *http.Request) {
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})

	if err != nil {
		log.Println(err)
		return
	}
	defer c.Close(websocket.StatusInternalError, "the sky is falling!")

	for {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute*10)
		defer cancel()

		_, message, err := c.Read(ctx)
		if err != nil {
			break
		}
		log.Printf("Received '%v'", string(message))

		parts := strings.Split(string(message), " ")
		if parts[0] == "mapgen" {
			len_str := parts[1]
			len, err := strconv.Atoi(len_str)

			response := "map " + len_str + "x" + len_str + " \n"
			for range len {
				for range len {
					response += "" + strconv.Itoa(rand.Intn(8)) + " "
				}
				response += "\n"
			}

			err = c.Write(ctx, websocket.MessageText, []byte(response))
			if err != nil {
				break
			}

			continue
		}

		// Echo the message back
		err = c.Write(ctx, websocket.MessageText, message)
		if err != nil {
			break
		}
	}
}
