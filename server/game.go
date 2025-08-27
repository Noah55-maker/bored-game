package main

import (
	"context"
	"fmt"

	"github.com/coder/websocket"
)

type Game struct {
	board [][]Tile
	seed, chunkSize float64

	players []*Player
	playerTurn int
}

func (g *Game) resizeBoard(length int) {
	g.board = make([][]Tile, length)
	for i := range length {
		g.board[i] = make([]Tile, length)
	}
}

func (g *Game) generateMap(length int) {
	g.resizeBoard(length)

	for i := range length {
		for j := range length {
			noise := perlinNoise(float64(j) / g.chunkSize, float64(i) / g.chunkSize, g.seed)
			tile := &g.board[i][j].tiletype

			if noise < .25 {
				*tile = OCEAN
			} else if noise < .4 {
				*tile = WATER
			} else if noise < .45 {
				*tile = COAST
			} else if noise < .52 {
				*tile = PLAINS
			} else if noise < .62 {
				*tile = GRASS
			} else if noise < .72 {
				*tile = FOREST
			} else if noise < .8 {
				*tile = MOUNTAIN
			} else {
				*tile = VOLCANO
			}
		}
	}
}

func (g *Game) updateWithGameState(player *Player, ctx context.Context) error {
	// player index
	response_player_index := fmt.Sprintf("player-index %d\n", player.player_index)

	// map
	response_map := fmt.Sprintf("map %d %f %f\n", len(g.board), g.chunkSize, g.seed)

	// troops
	response_troops := fmt.Sprintf("troops %d\n", len(g.players))
	for _, p := range g.players {
		response_troops += fmt.Sprintf("%d ", len(p.troops))
	}
	response_troops += "\n"

	for _, p := range g.players {
		for _, t := range p.troops {
			response_troops += fmt.Sprintf("%d %d,", t.x, t.y)
		}
		response_troops += "\n"
	}

	// modified tiles
	response_tiles := "modified-tiles\n"
	for i := range g.board {
		for j := range g.board[i] {
			if g.board[i][j].modified {
				response_tiles += "m"
			} else {
				response_tiles += "."
			}
		}
		response_tiles += "\n"
	}

	response := response_player_index + response_map + response_troops + response_tiles
	return player.c.Write(ctx, websocket.MessageText, []byte(response))
}

func (g *Game) updateWithMap(player *Player, ctx context.Context) error {
	response := fmt.Sprintf("broadcast\nupdate-map %d %f %f\n", len(g.board), g.chunkSize, g.seed)
	return player.c.Write(ctx, websocket.MessageText, []byte(response))
}

type Player struct {
	c *websocket.Conn
	connected bool

	player_index int
	troops []Troop
	wood, stone int
}
