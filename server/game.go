package main

import (
	"context"
	"fmt"

	"github.com/coder/websocket"
)

type Game struct {
	board [][]Tile
	seed, chunkSize float64

	players map[*Player]bool
	playerTurn int
}

func (g *Game) resizeBoard(length int) {
	g.board = make([][]Tile, length)
	for i := range length {
		g.board[i] = make([]Tile, length)
	}
}

func (g *Game) updateWithTroops(player *Player, ctx context.Context) error {
	yourTroops := len(player.troops)
	otherTroops := 0
	for p := range game.players {
		if p != player {
			otherTroops += len(p.troops)
		}
	}

	response := fmt.Sprintf("broadcast\ntroops %d %d\n", yourTroops, otherTroops)

	for _, t := range player.troops {
		response += fmt.Sprintf("%d %d,", t.x, t.y)
	}
	response += "\n"

	for p := range game.players {
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
	troops []Troop
	wood, stone int
}
