/** TODO
 * -------
 * Mouse hover fade - only show for valid moves
 * Boat behavior when troop dismounts
 */

import { init, showError, GamePiece, pickedData } from "./renderer.js";
import perlinNoise from "./noise.js"
import { fade as smoothFade, scale } from "./noise.js";

export let MAP_LENGTH = 19;

/** how many (tiles per noise value) you want: ~5 is a reasonable value */
let CHUNK_SIZE = 5;
let seed: number;
let fudgedChunkSize: number;

let playerTurn = 0;
let moves = 0;

const NUMBER_OF_STARTING_TROOPS = 3;
const players: Player[] = [];
const board: Tile[][] = [];

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
    SOLDIER_BLUE,
    SOLDIER_RED,
    LAVA,
    PORT,
    SHIP,
    CASTLE,
    WOOD,
    STONE,
}

const { GRASS, FOREST, PLAINS, MOUNTAIN, VOLCANO, WATER, COAST, OCEAN, SWAMP, SNOW, SOLDIER_BLUE, SOLDIER_RED, LAVA, PORT, SHIP, CASTLE, WOOD, STONE } = TileType;

// should be the same order as TileType
export const ASSET_NAMES = ['grass', 'forest', 'plains', 'mountain', 'volcano', 'water', 'coast', 'ocean', 'swamp', 'snow', 'soldierblue', 'soldierred', 'lava', 'port', 'ship', 'castle', 'wood', 'stone'];

class Troop {
    public x: number;
    public y: number;
    public isOnShip: boolean;

    public deltaX: number;
    public deltaY: number;
    public isMoving: boolean;
    public moveTime: number;

    constructor(positionX: number, positionY: number) {
        this.x = positionX;
        this.y = positionY;
        this.isOnShip = false;

        this.deltaX = 0;
        this.deltaY = 0;
        this.isMoving = false;
        this.moveTime = 0;
    }

    move(deltaX: number, deltaY: number) {
        this.deltaX = deltaX;
        this.deltaY = deltaY;
        this.x += deltaX;
        this.y += deltaY;
        this.isMoving = true;
        this.moveTime = new Date().getTime() / 1000;
    }
}

class Tile {
    public type: TileType;
    public modified: boolean;

    constructor(type: TileType) {
        this.type = type;
        this.modified = false;

        if (type === FOREST || type === MOUNTAIN) {
            if (Math.random() < .3)
                this.modified = true;
        }
    }

    isLandTile() {
        return (this.type !== COAST && this.type !== WATER && this.type !== OCEAN);
    }

    isModifiable() {
        return (this.type === COAST || this.type === MOUNTAIN || this.type === FOREST);
    }
}

class Player {
    public troops: Troop[];
    public selectedTroopIndex: number;

    constructor(...troops: Troop[]) {
        this.troops = troops;
        this.selectedTroopIndex = 0;
    }

    selectedTroop() {
        if (this.selectedTroopIndex >= this.troops.length) {
            this.selectedTroopIndex = 0;
        }
        return this.troops[this.selectedTroopIndex];
    }
}

function fade1(x: number) {
    return scale(Math.cos(x * Math.PI));
}

function fade2(x: number) {
    x += 1;
    const fPart = Math.floor(x);
    return (smoothFade(x-fPart) - .5) * Math.pow(-1, fPart) + .5;
}

// TODO: cache the fade values so they don't have to be (redundantly) calculated every frame
function drawBoard(gamePieces: GamePiece[], time: number) {
    for (let y = 0; y < MAP_LENGTH; y++) {
        for (let x = 0; x < MAP_LENGTH; x++) {
            const selectedTroop = players[playerTurn].selectedTroop();
            const [deltaX, deltaY] = [x - selectedTroop.x, y - selectedTroop.y];

            const fade = (Math.abs(deltaX) + Math.abs(deltaY) === 1 && troopCanMove(selectedTroop, deltaX, deltaY)
                || Math.abs(deltaX) + Math.abs(deltaY) === 0 && board[y][x].isModifiable());

            const terrain = board[y][x].type;
            gamePieces[terrain].draw(x, y, time, fade);

            if (terrain === VOLCANO)
                gamePieces[LAVA].draw(x, y, time, fade);

            if (board[y][x].modified) {
                if (terrain === COAST)
                    gamePieces[PORT].draw(x, y, time, fade);
                else if (terrain === PLAINS)
                    gamePieces[CASTLE].draw(x, y, time, fade);
                else if (terrain === FOREST)
                    gamePieces[WOOD].draw(x, y, time);
                else if (terrain === MOUNTAIN)
                    gamePieces[STONE].draw(x, y, time);
            }
        }
    }

    // draw player troops
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        for (let j = 0; j < p.troops.length; j++) {
            const fade = (playerTurn === i && players[playerTurn].selectedTroopIndex === j);
            const troop = p.troops[j];

            let [x, y] = [troop.x, troop.y];

            if (troop.isMoving) {
                const deltaTime = (new Date().getTime() / 1000) - troop.moveTime;
                if (deltaTime > 1)
                    troop.isMoving = false;

                x -= troop.deltaX * fade1(deltaTime);
                y -= troop.deltaY * fade1(deltaTime);
            }

            if (troop.isOnShip) {
                let rotation = 0;

                if (troop.deltaX >= 1) rotation = Math.PI;
                if (troop.deltaY >= 1) rotation = Math.PI / 2;
                if (troop.deltaY <= -1) rotation = -Math.PI / 2;

                gamePieces[SHIP].draw(x, y, time, false, rotation);
            }

            gamePieces[(i == 0 ? SOLDIER_BLUE : SOLDIER_RED)].draw(x, y, time, fade);
        }
    }
}

function generateMap(seed: number, changeChunkSize: boolean) {
    console.log(seed);

    if (changeChunkSize) {
        // we don't want every Nth tile to be the same every time
        fudgedChunkSize = CHUNK_SIZE + Math.random() * .2 - .1;
    }

    for (let i = 0; i < MAP_LENGTH; i++) {
        for (let j = 0; j < MAP_LENGTH; j++) {
            const noise = perlinNoise(j / fudgedChunkSize, i / fudgedChunkSize, seed);
            if (noise < .25) board[i][j] = new Tile(OCEAN);
            else if (noise < .4) board[i][j] = new Tile(WATER);
            else if (noise < .45) board[i][j] = new Tile(COAST);
            else if (noise < .52) board[i][j] = new Tile(PLAINS);
            else if (noise < .62) board[i][j] = new Tile(GRASS);
            else if (noise < .72) board[i][j] = new Tile(FOREST);
            else if (noise < .80) board[i][j] = new Tile(MOUNTAIN);
            else board[i][j] = new Tile(VOLCANO);
        }
    }

    // coast should be adjacent to a land tile
    for (let i = 0; i < MAP_LENGTH; i++) {
        for (let j = 0; j < MAP_LENGTH; j++) {
            if (board[i][j].type !== COAST)
                continue;

            if (i > 0 && board[i-1][j].isLandTile() ||
                i < MAP_LENGTH-1 && board[i+1][j].isLandTile() ||
                j > 0 && board[i][j-1].isLandTile() ||
                j < MAP_LENGTH-1 && board[i][j+1].isLandTile())
                continue;

            board[i][j] = new Tile(WATER);
        }
    }
}

function troopCanMove(troop: Troop, deltaX: number, deltaY: number): boolean {
    if (Math.abs(deltaX) + Math.abs(deltaY) !== 1)
        return false;

    const [newX, newY] = [troop.x + deltaX, troop.y + deltaY];

    if (newX < 0 || newX >= MAP_LENGTH || newY < 0 || newY >= MAP_LENGTH) {
        return false;
    }

    const currentTile = board[troop.y][troop.x].type;
    const newTile = board[newY][newX].type;

    if (newTile == VOLCANO) {
        return false;
    }

    if (newTile == WATER || newTile == OCEAN) {
        return (troop.isOnShip || (currentTile == COAST && board[troop.y][troop.x].modified));
    }

    // check for other troops
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        for (let j = 0; j < p.troops.length; j++) {
            if (p.troops[j].x == newX && p.troops[j].y == newY)
                return false;
        }
    }

    return true;
}

// You currently cannot remount a ship without a port, I'm not a fan of this behavior
function moveTroop(troop: Troop, deltaX: number, deltaY: number): boolean {
    if (!troopCanMove(troop, deltaX, deltaY)) {
        return false;
    }

    const [newX, newY] = [troop.x + deltaX, troop.y + deltaY];

    const currentTile = board[troop.y][troop.x].type;
    const newTile = board[newY][newX].type;

    if (currentTile === COAST) {
        // if player has resources to build boat...
        if (newTile === WATER || newTile === OCEAN) {
            board[newY][newX].modified = true;
            troop.isOnShip = true;
        }
    }

    if (currentTile === WATER || currentTile === OCEAN) {
        if (newTile === WATER || newTile === OCEAN) {
            board[troop.y][troop.x].modified = false;
            board[newY][newX].modified = true;
        }
        // if (newTile === COAST) ...
        else { // moving to coast or land tile
            troop.isOnShip = false;
        }
    }

    troop.move(deltaX, deltaY);
    return true;
}

/**
 * Search all players to see if any are on this tile
 * @param tileX x coordinate of the tile
 * @param tileY y coordinate of the tile
 * @returns [-1, -1] if there's no troop, [playerIndex, playerTroopIndex] otherwise
 */
function tileHasTroop(tileX: number, tileY: number) {
    for (let i = 0; i < players.length; i++) {
        const playerTroops = players[i].troops;
        for (let j = 0; j < playerTroops.length; j++) {
            if (playerTroops[j].x == tileX && playerTroops[j].y == tileY)
                return [i, j];
        }
    }

    return [-1, -1];
}

function handleKeyDown(event: KeyboardEvent) {
    const currentPlayer = players[playerTurn];
    const focusedTroop = currentPlayer.selectedTroop();

    // move troop
    if (event.key == "ArrowLeft") {
        moveTroop(focusedTroop, -1, 0);
        playerAction();
    }
    else if (event.key == "ArrowRight") {
        moveTroop(focusedTroop, +1, 0);
        playerAction();
    }
    else if (event.key == "ArrowUp") {
        moveTroop(focusedTroop, 0, -1);
        playerAction();
    }
    else if (event.key == "ArrowDown") {
        moveTroop(focusedTroop, 0, +1);
        playerAction();
    }

    // modify tile
    else if (event.key == " ") {
        board[focusedTroop.y][focusedTroop.x].modified = !board[focusedTroop.y][focusedTroop.x].modified;

        if (board[focusedTroop.y][focusedTroop.x].type === WATER || board[focusedTroop.y][focusedTroop.x].type === OCEAN)
            focusedTroop.isOnShip = !focusedTroop.isOnShip;
        playerAction();
    }

    if (event.key == "Enter") {
        nextPlayerTurn();
    }

    if (event.key == "t") {
        players[playerTurn].selectedTroopIndex++;
        if (players[playerTurn].selectedTroopIndex >= currentPlayer.troops.length)
            players[playerTurn].selectedTroopIndex = 0;
    }

    if (event.key == "m") {
        seed = Math.random() * 1e9;
        generateMap(seed, true);
    }

    if (event.key == "1") {
        MAP_LENGTH--;
        if (MAP_LENGTH == 0)
            MAP_LENGTH = 1;
        console.log('Map length = ' + MAP_LENGTH);
        generateMap(seed, false);
    }

    if (event.key == "2") {
        MAP_LENGTH++;
        console.log('Map length = ' + MAP_LENGTH);
        board.push([]);
        generateMap(seed, false);
    }

    if (event.key == "9") {
        CHUNK_SIZE--;
        if (CHUNK_SIZE == 0)
            CHUNK_SIZE = 1;
        generateMap(seed, true);
    }

    if (event.key == "0") {
        CHUNK_SIZE++;
        generateMap(seed, true);
    }
}

function handleMouseDown(_event: MouseEvent) {
    const [x, y] = [pickedData[0], pickedData[1]];
    const res = tileHasTroop(x, y);
    const currentPlayer = players[playerTurn];

    // if there's no troop, try to move currently selected troop, otherwise add a troop
    if (res[0] === -1) {
        const selectedTroop = currentPlayer.selectedTroop();

        if (moveTroop(selectedTroop, x - selectedTroop.x, y - selectedTroop.y)) {

        }
        else {
            currentPlayer.troops.push(new Troop(x, y));
            currentPlayer.selectedTroopIndex = currentPlayer.troops.length - 1;
        }
    }

    else if (res[0] != playerTurn) {
        return;
    }

    // otherwise, modify the tile or change troop focus
    else { // if (res[0] == playerTurn)
        if (currentPlayer.selectedTroopIndex == res[1]) {
            board[y][x].modified = !board[y][x].modified;
        }
        else {
            currentPlayer.selectedTroopIndex = res[1];
            return;
        }
    }

    playerAction();
}

function playerAction() {
    moves++;
    if (moves === 3) {
        moves = 0;
        nextPlayerTurn();
    }
}

function nextPlayerTurn() {
    playerTurn++;
    if (playerTurn >= players.length)
        playerTurn = 0;
}

function mouseDown_beginning(_event: MouseEvent) {
    const [x, y] = [pickedData[0], pickedData[1]];
    const res = tileHasTroop(x, y);

    // if there is a troop on this tile, don't do anything
    if (res[0] !== -1) {
        return;
    }

    // check for nearby opponent troops
    for (let i = 0; i < players.length; i++) {
        if (playerTurn === i)
            continue;

        for (let j = 0; j < players[i].troops.length; j++) {
            const otherTroop = players[i].troops[j];
            if (Math.abs(x - otherTroop.x) + Math.abs(y - otherTroop.y) <= 3) {
                // too close to enemy troop
                return;
            }
        }
    }

    const tileType = board[y][x].type;
    if (tileType === VOLCANO || tileType === WATER || tileType === OCEAN) {
        return;
    }

    players[playerTurn].troops.push(new Troop(x, y));

    moves++;
    if (moves === players.length * NUMBER_OF_STARTING_TROOPS) {
        removeEventListener("mousedown", mouseDown_beginning);
        addEventListener("mousedown", handleMouseDown);

        moves = 0;
        console.log('end of beginning stage');
        // return;
    }
    nextPlayerTurn();
    return;
}

try {
    players.push(
        new Player(new Troop(0, 0)),
        new Player(new Troop(MAP_LENGTH-1, MAP_LENGTH-1))
        // new Player(), new Player()
    );
    addEventListener("keydown", handleKeyDown);
    addEventListener("mousedown", mouseDown_beginning);

    // populate array
    for (let i = 0; i < MAP_LENGTH; i++)
        board.push([]);

    seed = Math.random() * 1e9;
    generateMap(seed, true);

    init(drawBoard);
} catch (e) {
    showError(`Uncaught JavaScript exception: ${e}`);
}
