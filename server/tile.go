package main

const (
    GRASS = iota
    FOREST
    PLAINS
    MOUNTAIN
    VOLCANO
    WATER
    COAST
    OCEAN
    SWAMP
    SNOW
    SOLDIER_BLUE
    SOLDIER_RED
    LAVA
    PORT
    SHIP
    CASTLE
    WOOD
    STONE
)

type Tile struct {
	tiletype int
	modified bool
}
