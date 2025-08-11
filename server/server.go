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

var board [][]Tile

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
			len_str, chunk_str := parts[1], parts[2]
			len, err := strconv.Atoi(len_str)
			resizeBoard(len)

			chunk_size, err := strconv.ParseFloat(chunk_str, 64)
			chunk_size += rand.Float64() * .2 - .1
			seed := rand.Float64()*1e9

			response := "map " + len_str + "x" + len_str + " \n"
			for i := range len {
				for j := range len {
					noise := perlinNoise(float64(j) / chunk_size, float64(i) / chunk_size, seed)
					var tile int

					if (noise < .25) {
						tile = OCEAN
					} else if (noise < .4) {
			     		tile = WATER
				    } else if (noise < .45) {
				     	tile = COAST
				    } else if (noise < .52) {
				     	tile = PLAINS
				    } else if (noise < .62) {
				     	tile = GRASS
				    } else if (noise < .72) {
				     	tile = FOREST
				    } else if (noise < .80) {
				     	tile = MOUNTAIN
				    } else {
						tile = VOLCANO
					}

					board[i][j].tiletype = tile
					response += strconv.Itoa(tile) + " "
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

func resizeBoard(length int) {
	board = make([][]Tile, length)
	for i := range length {
		board[i] = make([]Tile, length)
	}
}
