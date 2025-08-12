package main

import "github.com/coder/websocket"

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

type Player struct {
	c *websocket.Conn
	troops []Troop
	wood, stone int
}
