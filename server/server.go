/**
 * TODO
 * - assign message IDs to match responses with requests
 * - safe message parsing (avoid crashing with malformed requests)
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

var games []*Game

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
	player.connected = true
	player.c = c
	player.player_index = -1

	var game *Game
	inGame := false

	for {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute*10)
		defer cancel()

		_, message, err := c.Read(ctx)
		if err != nil {
			break
		}
		log.Printf("Received '%v'", string(message))

		parts := strings.Split(string(message), " ")
		if parts[0] == "create-game" {
			if inGame {
				continue
			}

			inGame = true
			game = new(Game)
			games = append(games, game)

			game.players = make([]*Player, 0)
			game.players = append(game.players, &player)
			player.player_index = 0

			game.chunkSize = 5.23
			game.seed = rand.Float64() * 1e9
			game.generateMap(19)

			c.Write(ctx, websocket.MessageText, []byte("ack"))
			game.updateWithMap(&player, ctx)

			continue
		} else if parts[0] == "join-game" {
			if inGame || len(games) == 0 {
				continue
			}

			inGame = true
			game = games[len(games)-1]
			game.players = append(game.players, &player)
			player.player_index = len(game.players) - 1

			game.updateWithGameState(&player, ctx)

			for _, p := range game.players {
				if p != &player && p.connected {
					p.c.Write(ctx, websocket.MessageText, []byte("broadcast\nnew-player"))
				}
			}

			continue
		}

		if !inGame {
			c.Write(ctx, websocket.MessageText, []byte("Error: you are not in a game"))
			continue
		}

		if parts[0] == "generate-map" {
			len, _ := strconv.Atoi(parts[1])
			game.chunkSize, _ = strconv.ParseFloat(parts[2], 64)
			game.seed = rand.Float64() * 1e9

			game.generateMap(len)

			for _, p := range game.players {
				if p.connected {
					game.updateWithMap(p, ctx)
				}
			}

			continue
		} else if parts[0] == "update-map" {
			len, _ := strconv.Atoi(parts[1])
			game.chunkSize, _ = strconv.ParseFloat(parts[2], 64)

			game.generateMap(len)

			for _, p := range game.players {
				if p != &player && p.connected {
					game.updateWithMap(p, ctx)
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

			response := fmt.Appendf(nil, "broadcast\nadd-troop %d %d %d", player.player_index, x, y)
			for _, p := range game.players {
				if p != &player && p.connected {
					p.c.Write(ctx, websocket.MessageText, response)
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

			for _, p := range game.players {
				if p != &player && p.connected {
					response := fmt.Sprintf("broadcast\nmove-troop %d %d %d %d", player.player_index, troopIndex, x, y)
					p.c.Write(ctx, websocket.MessageText, []byte(response))
				}
			}

			continue
		} else if parts[0] == "modify-tile" {
			x, _ := strconv.Atoi(parts[1])
			y, _ := strconv.Atoi(parts[2])

			game.board[y][x].modified = !game.board[y][x].modified

			err = c.Write(ctx, websocket.MessageText, []byte("ack"))
			if err != nil {
				break
			}

			for _, p := range game.players {
				if p != &player && p.connected {
					response := fmt.Sprintf("broadcast\nmodify-tile %d %d", x, y)
					p.c.Write(ctx, websocket.MessageText, []byte(response))
				}
			}

			continue
		}

		// Echo the message back
		err = c.Write(ctx, websocket.MessageText, message)
		if err != nil {
			break
		}
		log.Println("Unrecognized command")
	}

	player.connected = false
}
