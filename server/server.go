/**
 * TODO
 * - functionality to create separate games with their own players
 * - assign message IDs to match responses with requests
 * - safe message parsing (avoid crashing with bad requests)
 */

package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"
)

var game Game

func main() {
	game.players = make(map[*Player]bool)

	address := "0.0.0.0:10000"
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

	var player Player
	player.c = c
	game.players[&player] = true
	log.Printf("There are now %d players", len(game.players))

	for {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute*10)
		defer cancel()

		_, message, err := c.Read(ctx)
		if err != nil {
			break
		}
		log.Printf("Received '%v'", string(message))

		parts := strings.Split(string(message), " ")
		if parts[0] == "generate-map" {
			len_str, chunk_str := parts[1], parts[2]
			len, err := strconv.Atoi(len_str)
			game.resizeBoard(len)

			game.chunkSize, err = strconv.ParseFloat(chunk_str, 64)
			game.chunkSize += rand.Float64() * .2 - .1

			game.seed = rand.Float64() * 1e9

			for i := range len {
				for j := range len {
					noise := perlinNoise(float64(j) / game.chunkSize, float64(i) / game.chunkSize, game.seed)
					var tile int

					if noise < .25 {
						tile = OCEAN
					} else if noise < .4 {
						tile = WATER
					} else if noise < .45 {
						tile = COAST
					} else if noise < .52 {
						tile = PLAINS
					} else if noise < .62 {
						tile = GRASS
					} else if noise < .72 {
						tile = FOREST
					} else if noise < .8 {
						tile = MOUNTAIN
					} else {
						tile = VOLCANO
					}

					game.board[i][j].tiletype = tile
				}
			}

			response := fmt.Sprintf("map %d %f %f\n", len, game.chunkSize, game.seed)
			for p, connected := range game.players {
				if !connected {
					continue
				}

				if p == &player {
					err = p.c.Write(ctx, websocket.MessageText, []byte(response))
				} else {
					err = p.c.Write(ctx, websocket.MessageText, []byte("broadcast\n" + response))
				}
				if err != nil {
					log.Println("error in sending message")
				}
			}

			continue
		} else if parts[0] == "add-troop" {
			x, err := strconv.Atoi(parts[1])
			y, err := strconv.Atoi(parts[2])

			player.troops = append(player.troops, Troop{x: x, y: y, isOnShip: false})

			err = c.Write(ctx, websocket.MessageText, []byte("ack"))
			if err != nil {
				break
			}

			for p := range game.players {
				if p != &player {
					game.updateWithTroops(p, ctx)
				}
			}

			continue
		} else if parts[0] == "move-troop" {
			troopIndex, err := strconv.Atoi(parts[1])
			x, err := strconv.Atoi(parts[2])
			y, err := strconv.Atoi(parts[3])

			player.troops[troopIndex].x = x
			player.troops[troopIndex].y = y

			err = c.Write(ctx, websocket.MessageText, []byte("ack"))
			if err != nil {
				break
			}

			for p := range game.players {
				if p != &player {
					game.updateWithTroops(p, ctx)
				}
			}

			continue
		}

		// Echo the message back
		err = c.Write(ctx, websocket.MessageText, message)
		if err != nil {
			break
		}
	}

	game.players[&player] = false
}
