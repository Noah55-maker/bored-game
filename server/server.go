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
	game.players = append(game.players, &player)
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
			err = c.Write(ctx, websocket.MessageText, []byte(response))
			if err != nil {
				break
			}

			continue
		} else if parts[0] == "request-map" {
			response := fmt.Sprintf("map %d %f %f\n", len(game.board), game.chunkSize, game.seed)
			err = c.Write(ctx, websocket.MessageText, []byte(response))
			if err != nil {
				break
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

			continue
		} else if parts[0] == "fetch-troops" {
			yourTroops := len(player.troops)
			otherTroops := 0
			for i := range len(game.players) {
				if game.players[i] != &player {
					otherTroops += len(game.players[i].troops)
				}
			}

			response := fmt.Sprintf("troops %d %d\n", yourTroops, otherTroops)

			for i := range len(player.troops) {
				response += fmt.Sprintf("%d %d,", player.troops[i].x, player.troops[i].y)
			}
			response += "\n"

			for _, p := range game.players {
				if p == &player {
					continue
				}

				for _, t := range p.troops {
					response += fmt.Sprintf("%d %d,", t.x, t.y)
				}
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
