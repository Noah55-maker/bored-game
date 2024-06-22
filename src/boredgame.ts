import { init } from "./renderer";
import { GamePiece } from "./renderer";
import { showError } from "./renderer";

const MAP_WIDTH = 9;
const MAP_HEIGHT = 9;

const tileModifier: boolean[][] = [];

enum TileType {
    GRASS,
    FOREST,
    PLAINS,
    MOUNTAIN,
    VOLCANO,
    WATER,
    COAST,
    OCEAN,
    SWAMP,
    SNOW,
}

const { GRASS, FOREST, PLAINS, MOUNTAIN, VOLCANO, WATER, COAST, OCEAN, SWAMP, SNOW } = TileType;

const ISLAND_MAP: TileType[][] = [
    [WATER, WATER, COAST, WATER, WATER, COAST, WATER, SNOW, SNOW],
    [WATER, WATER, PLAINS, FOREST, FOREST, PLAINS, WATER, WATER, SNOW],
    [WATER, WATER, PLAINS, FOREST, MOUNTAIN, FOREST, PLAINS, COAST, WATER],
    [WATER, PLAINS, FOREST, MOUNTAIN, VOLCANO, MOUNTAIN, FOREST, WATER, WATER],
    [WATER, PLAINS, MOUNTAIN, MOUNTAIN, VOLCANO, VOLCANO, FOREST, FOREST, WATER],
    [WATER, PLAINS, PLAINS, MOUNTAIN, MOUNTAIN, COAST, FOREST, PLAINS, WATER],
    [WATER, COAST, PLAINS, PLAINS, WATER, WATER, PLAINS, PLAINS, COAST],
    [WATER, WATER, PLAINS, PLAINS, COAST, PLAINS, PLAINS, WATER, WATER],
    [WATER, WATER, WATER, WATER, WATER, WATER, COAST, WATER, WATER]
];

const boardLayout = ISLAND_MAP;

class Troop extends GamePiece {
    public x: number;
    public y: number;
    constructor(positionX: number, positionY: number) {
        super(0, [], 0, []);
        this.x = positionX;
        this.y = positionY;
    }
}

class Tile extends GamePiece {

}

class Player {
    public troops: Troop[];
    constructor(troops: Troop[]) {
        this.troops = troops;
    }


}

const player1 = new Player([new Troop(0, 0)]);
const player2 = new Player([new Troop(MAP_WIDTH-1, MAP_HEIGHT-1)]);

function drawBoard(gamePieces: GamePiece[], time: number) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const terrain = boardLayout[y][x];
            gamePieces[terrain].draw(x, y, time);

            if (terrain === VOLCANO)
                gamePieces[12].draw(x, y, time);

            if (tileModifier[y][x]) {
                if (terrain === COAST)
                    gamePieces[11].draw(x, y, time);
                else if (terrain === PLAINS)
                    gamePieces[14].draw(x, y, time);
                else if (terrain === WATER)
                    gamePieces[13].draw(x, y, time);
            }
        }
    }

    // draw soldiers
    for (let i = 0; i < player1.troops.length; i++)
        gamePieces[10].draw(player1.troops[i].x, player1.troops[i].y, time);

    for (let i = 0; i < player2.troops.length; i++)
        gamePieces[15].draw(player2.troops[i].x, player2.troops[i].y, time);

}

try {
    addEventListener("keydown", (event) => {
        // move troop
        if (event.key == "1" || event.key == "ArrowLeft")
            player1.troops[0].x--;
        else if (event.key == "9" || event.key == "ArrowRight")
            player1.troops[0].x++;
        else if (event.key == "3" || event.key == "ArrowDown")
            player1.troops[0].y++;
        else if (event.key == "7" || event.key == "ArrowUp")
            player1.troops[0].y--;

        // modify tile
        else if (event.key == " ")
            if (player1.troops[0].x >= 0 && player1.troops[0].x < MAP_WIDTH &&
                player1.troops[0].y >= 0 && player1.troops[0].y < MAP_HEIGHT) {
                tileModifier[player1.troops[0].y][player1.troops[0].x] = !tileModifier[player1.troops[0].y][player1.troops[0].x];
            }
    });

    // populate array
    for (let i = 0; i < MAP_HEIGHT; i++) {
        tileModifier.push([]);
        for (let j = 0; j < MAP_WIDTH; j++) {
            tileModifier[i].push(false);
        }
    }

    // modify a few tiles
    tileModifier[3][1] = true;
    tileModifier[7][7] = true;
    tileModifier[5][5] = true;


    init(drawBoard);
} catch (e) {
    showError(`Uncaught JavaScript exception: ${e}`);
}
