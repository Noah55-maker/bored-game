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

const OTHER_MAP: TileType[][] = [
    [OCEAN, MOUNTAIN, SNOW, SNOW, COAST, WATER, WATER, OCEAN, OCEAN],
    [OCEAN, OCEAN, MOUNTAIN, SNOW, FOREST, WATER, OCEAN, OCEAN, VOLCANO],
    [OCEAN, OCEAN, MOUNTAIN, FOREST, FOREST, FOREST, OCEAN, OCEAN, VOLCANO],
    [OCEAN, OCEAN, SNOW, MOUNTAIN, PLAINS, COAST, FOREST, PLAINS, PLAINS],
    [SNOW, SNOW, OCEAN, GRASS, PLAINS, WATER, WATER, PLAINS, COAST],
    [FOREST, FOREST, FOREST, FOREST, PLAINS, PLAINS, WATER, WATER, WATER],
    [FOREST, MOUNTAIN, FOREST, PLAINS, PLAINS, PLAINS, PLAINS, PLAINS, WATER],
    [MOUNTAIN, MOUNTAIN, FOREST, PLAINS, PLAINS, PLAINS, PLAINS, WATER, WATER],
    [MOUNTAIN, MOUNTAIN, MOUNTAIN, MOUNTAIN, PLAINS, COAST, WATER, WATER, WATER]
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

const player1 = new Player([new Troop(0, 0), new Troop(1, 1)]);
const player2 = new Player([new Troop(MAP_WIDTH-1, MAP_HEIGHT-1)]);

let playerTurn = 1;

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
        const currentPlayer = (playerTurn === 1 ? player1 : player2);
        
        // move troop
        if ((event.key == "1" || event.key == "ArrowLeft") && currentPlayer.troops[0].x > 0)
            currentPlayer.troops[0].x--;
        else if ((event.key == "9" || event.key == "ArrowRight") && currentPlayer.troops[0].x < MAP_WIDTH-1)
            currentPlayer.troops[0].x++;
        else if ((event.key == "7" || event.key == "ArrowUp") && currentPlayer.troops[0].y > 0)
            currentPlayer.troops[0].y--;
        else if ((event.key == "3" || event.key == "ArrowDown") && currentPlayer.troops[0].y < MAP_HEIGHT-1)
            currentPlayer.troops[0].y++;

        // modify tile
        else if (event.key == " ")
            if (currentPlayer.troops[0].x >= 0 && currentPlayer.troops[0].x < MAP_WIDTH &&
                currentPlayer.troops[0].y >= 0 && currentPlayer.troops[0].y < MAP_HEIGHT) {
                tileModifier[currentPlayer.troops[0].y][currentPlayer.troops[0].x] = !tileModifier[currentPlayer.troops[0].y][currentPlayer.troops[0].x];
            }

        if (event.key == "Enter") {
            if (playerTurn === 1)
                playerTurn = 2;
            else
                playerTurn = 1;
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
