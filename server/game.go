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

func (g *Game) updateWithMap(player *Player, ctx context.Context) error {
	response := fmt.Sprintf("broadcast\nmap %d %f %f\n", len(g.board), g.chunkSize, g.seed)
	return player.c.Write(ctx, websocket.MessageText, []byte(response))
}

func (g *Game) updateWithTroops(player *Player, ctx context.Context) error {
	yourTroops := len(player.troops)
	otherTroops := 0
	for _, p := range g.players {
		if p != player {
			otherTroops += len(p.troops)
		}
	}

	response := fmt.Sprintf("broadcast\ntroops %d %d\n", yourTroops, otherTroops)

	for _, t := range player.troops {
		response += fmt.Sprintf("%d %d,", t.x, t.y)
	}
	response += "\n"

	for _, p := range g.players {
		if p == player {
			continue
		}

		for _, t := range p.troops {
			response += fmt.Sprintf("%d %d,", t.x, t.y)
		}
	}

	return player.c.Write(ctx, websocket.MessageText, []byte(response))
}

type Player struct {
	c *websocket.Conn
	connected bool

	troops []Troop
	wood, stone int
}
