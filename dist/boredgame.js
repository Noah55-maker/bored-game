/** TODO
 * -------
 * Mouse hover fade - only show for valid moves
 * Boat behavior when troop dismounts
 */
import { init, pickedData } from "./renderer.js";
import perlinNoise from "./noise.js";
export let MAP_LENGTH = 19;
/** how many (tiles per noise value) you want: ~5 is a reasonable value */
let CHUNK_SIZE = 5.03;
let seed;
let playerTurn = 0;
let moves = 0;
let lastActionTime = 0;
let turnHappened = false;
const NUMBER_OF_STARTING_TROOPS = 3;
const players = [];
const board = [];
// const socket = new WebSocket('ws://bored-game-as81.onrender.com/echo');
const socket = new WebSocket("ws://localhost:10000/echo");
const recievedMessages = [];
socket.onmessage = (msg) => {
    console.log(msg);
    recievedMessages.push(msg.data);
    const lines = msg.data.split("\n");
    if (!lines[0].startsWith("broadcast")) {
        return;
    }
    const line1 = lines[1].split(" ");
    switch (line1[0]) {
        case "map": {
            for (let i = 0; i < parseInt(line1[1]) - MAP_LENGTH; i++) {
                board.push([]);
            }
            [MAP_LENGTH, CHUNK_SIZE, seed] = [parseInt(line1[1]), parseFloat(line1[2]), parseFloat(line1[3])];
            generateMap();
            break;
        }
        case "troops": {
            for (let i = 0; i < lines.length - 2; i++) {
                players[i].troops = [];
                const parts = lines[i + 2].split(",");
                const numTroops = parseInt(line1[i + 1]);
                for (let j = 0; j < numTroops; j++) {
                    const coord = parts[j].split(" ");
                    const [x, y] = [parseInt(coord[0]), parseInt(coord[1])];
                    players[i].troops.push(new Troop(x, y));
                }
            }
            break;
        }
        case "modify-tile": {
            const [x, y] = [parseInt(line1[1]), parseInt(line1[2])];
            board[y][x].modified = !board[y][x].modified;
        }
    }
};
var TileType;
(function (TileType) {
    TileType[TileType["GRASS"] = 0] = "GRASS";
    TileType[TileType["FOREST"] = 1] = "FOREST";
    TileType[TileType["PLAINS"] = 2] = "PLAINS";
    TileType[TileType["MOUNTAIN"] = 3] = "MOUNTAIN";
    TileType[TileType["VOLCANO"] = 4] = "VOLCANO";
    TileType[TileType["WATER"] = 5] = "WATER";
    TileType[TileType["COAST"] = 6] = "COAST";
    TileType[TileType["OCEAN"] = 7] = "OCEAN";
    TileType[TileType["SWAMP"] = 8] = "SWAMP";
    TileType[TileType["SNOW"] = 9] = "SNOW";
    TileType[TileType["SOLDIER_BLUE"] = 10] = "SOLDIER_BLUE";
    TileType[TileType["SOLDIER_RED"] = 11] = "SOLDIER_RED";
    TileType[TileType["LAVA"] = 12] = "LAVA";
    TileType[TileType["PORT"] = 13] = "PORT";
    TileType[TileType["SHIP"] = 14] = "SHIP";
    TileType[TileType["CASTLE"] = 15] = "CASTLE";
    TileType[TileType["WOOD"] = 16] = "WOOD";
    TileType[TileType["STONE"] = 17] = "STONE";
})(TileType || (TileType = {}));
const { GRASS, FOREST, PLAINS, MOUNTAIN, VOLCANO, WATER, COAST, OCEAN, SWAMP, SNOW, SOLDIER_BLUE, SOLDIER_RED, LAVA, PORT, SHIP, CASTLE, WOOD, STONE } = TileType;
// should be the same order as TileType
export const ASSET_NAMES = ['grass', 'forest', 'plains', 'mountain', 'volcano', 'water', 'coast', 'ocean', 'swamp', 'snow', 'soldierblue', 'soldierred', 'lava', 'port', 'ship', 'castle', 'wood', 'stone'];
class Troop {
    x;
    y;
    isOnShip;
    deltaX;
    deltaY;
    isMoving;
    moveTime;
    constructor(positionX, positionY) {
        this.x = positionX;
        this.y = positionY;
        this.isOnShip = false;
        this.deltaX = 0;
        this.deltaY = 0;
        this.isMoving = false;
        this.moveTime = 0;
    }
    move(deltaX, deltaY) {
        this.deltaX = deltaX;
        this.deltaY = deltaY;
        this.x += deltaX;
        this.y += deltaY;
        this.isMoving = true;
        this.moveTime = new Date().getTime() / 1000;
    }
}
class Tile {
    type;
    modified;
    fade;
    constructor(type, modified = false) {
        this.type = type;
        this.modified = modified;
        this.fade = false;
    }
    isLandTile() {
        return (this.type !== COAST && this.type !== WATER && this.type !== OCEAN);
    }
    isModifiable() {
        return (this.type === COAST || this.type === MOUNTAIN || this.type === FOREST);
    }
}
class Player {
    troops;
    selectedTroopIndex;
    wood;
    stone;
    constructor(...troops) {
        this.troops = troops;
        this.selectedTroopIndex = 0;
        this.wood = 0;
        this.stone = 0;
    }
    selectedTroop() {
        if (this.selectedTroopIndex >= this.troops.length) {
            this.selectedTroopIndex = 0;
        }
        return this.troops[this.selectedTroopIndex];
    }
    async addTroop(x, y) {
        this.troops.push(new Troop(x, y));
        const l = recievedMessages.length;
        socket.send(`add-troop ${x} ${y}`);
        while (recievedMessages.length == l) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }
}
function normalizedFade(x) {
    return (Math.cos(x * Math.PI) + 1) / 2;
}
function drawBoardInstanced(gamePieces, time) {
    for (let y = 0; y < MAP_LENGTH; y++) {
        for (let x = 0; x < MAP_LENGTH; x++) {
            if (turnHappened && players[0].troops.length != 0) {
                const selectedTroop = players[0].selectedTroop();
                const [deltaX, deltaY] = [x - selectedTroop.x, y - selectedTroop.y];
                board[y][x].fade = (Math.abs(deltaX) + Math.abs(deltaY) === 1 && troopCanMove(selectedTroop, deltaX, deltaY)
                    || Math.abs(deltaX) + Math.abs(deltaY) === 0 && board[y][x].isModifiable());
            }
        }
    }
    turnHappened = false;
    const instanceCount = [];
    const xPositions = [];
    const yPositions = [];
    const fade = [];
    const rotation = [];
    for (let i = 0; i < ASSET_NAMES.length; i++) {
        instanceCount[i] = 0;
        xPositions.push([]);
        yPositions.push([]);
        fade.push([]);
        rotation.push([]);
    }
    function addPiece(gamePiece, x, y, fades = false, rotationAngle = 0) {
        instanceCount[gamePiece]++;
        xPositions[gamePiece].push(x);
        yPositions[gamePiece].push(y);
        fade[gamePiece].push(fades);
        rotation[gamePiece].push(rotationAngle);
    }
    for (let y = 0; y < MAP_LENGTH; y++) {
        for (let x = 0; x < MAP_LENGTH; x++) {
            const terrain = board[y][x].type;
            const fade = board[y][x].fade;
            addPiece(terrain, x, y, fade);
            if (terrain === VOLCANO)
                addPiece(LAVA, x, y);
            if (board[y][x].modified) {
                if (terrain === COAST)
                    addPiece(PORT, x, y, fade);
                else if (terrain === PLAINS)
                    addPiece(CASTLE, x, y, fade);
                else if (terrain === FOREST)
                    addPiece(WOOD, x, y);
                else if (terrain === MOUNTAIN)
                    addPiece(STONE, x, y);
            }
        }
    }
    // draw player troops
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const soldierIndex = (i == 0 ? SOLDIER_BLUE : SOLDIER_RED);
        for (let j = 0; j < p.troops.length; j++) {
            const isSelected = (i === 0 && players[0].selectedTroopIndex === j);
            const troop = p.troops[j];
            let [x, y] = [troop.x, troop.y];
            if (troop.isMoving) {
                const deltaTime = (new Date().getTime() / 1000) - troop.moveTime;
                if (deltaTime > 1)
                    troop.isMoving = false;
                x -= troop.deltaX * normalizedFade(deltaTime);
                y -= troop.deltaY * normalizedFade(deltaTime);
            }
            if (troop.isOnShip) {
                let rotation = 0;
                if (troop.deltaX >= 1)
                    rotation = Math.PI;
                if (troop.deltaY >= 1)
                    rotation = Math.PI / 2;
                if (troop.deltaY <= -1)
                    rotation = -Math.PI / 2;
                addPiece(SHIP, x, y, false, rotation);
            }
            addPiece(soldierIndex, x, y, isSelected);
        }
    }
    gamePieces.forEach((gp, index) => {
        if (instanceCount[index] > 0) {
            gp.drawMultiple(instanceCount[index], xPositions[index], yPositions[index], time, fade[index], rotation[index]);
        }
    });
}
function generateMap() {
    console.log("seed = " + seed);
    turnHappened = true;
    for (let i = 0; i < MAP_LENGTH; i++) {
        for (let j = 0; j < MAP_LENGTH; j++) {
            const noise = perlinNoise(j / CHUNK_SIZE, i / CHUNK_SIZE, seed);
            if (noise < .25)
                board[i][j] = new Tile(OCEAN);
            else if (noise < .4)
                board[i][j] = new Tile(WATER);
            else if (noise < .45)
                board[i][j] = new Tile(COAST);
            else if (noise < .52)
                board[i][j] = new Tile(PLAINS);
            else if (noise < .62)
                board[i][j] = new Tile(GRASS);
            else if (noise < .72)
                board[i][j] = new Tile(FOREST);
            else if (noise < .8)
                board[i][j] = new Tile(MOUNTAIN);
            else
                board[i][j] = new Tile(VOLCANO);
        }
    }
    // coast should be adjacent to a land tile
    for (let i = 0; i < MAP_LENGTH; i++) {
        for (let j = 0; j < MAP_LENGTH; j++) {
            if (board[i][j].type !== COAST)
                continue;
            if (i > 0 && board[i - 1][j].isLandTile() ||
                i < MAP_LENGTH - 1 && board[i + 1][j].isLandTile() ||
                j > 0 && board[i][j - 1].isLandTile() ||
                j < MAP_LENGTH - 1 && board[i][j + 1].isLandTile())
                continue;
            board[i][j] = new Tile(WATER);
        }
    }
}
function troopCanMove(troop, deltaX, deltaY) {
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
        return troop.isOnShip || (currentTile == COAST && board[troop.y][troop.x].modified);
    }
    // check for other troops
    if (tileHasTroop(newX, newY)[0] != -1)
        return false;
    return true;
}
/**
 * Attempts to move the specified troop by the specified tiles
 * @param troop The troop to move
 * @param deltaX The number of tiles to move in the x direction
 * @param deltaY The number of tiles to move in the y direction
 * @returns true if troop was moved
 */
function moveTroop(troop, deltaX, deltaY) {
    if (!troopCanMove(troop, deltaX, deltaY))
        return false;
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
    socket.send(`move-troop ${players[0].selectedTroopIndex} ${troop.x} ${troop.y}`);
    return true;
}
/**
 * Search all players to see if any are on this tile
 * @param tileX x coordinate of the tile
 * @param tileY y coordinate of the tile
 * @returns [-1, -1] if there's no troop, [playerIndex, playerTroopIndex] otherwise
 */
function tileHasTroop(tileX, tileY) {
    for (let i = 0; i < players.length; i++) {
        const playerTroops = players[i].troops;
        for (let j = 0; j < playerTroops.length; j++) {
            if (playerTroops[j].x == tileX && playerTroops[j].y == tileY)
                return [i, j];
        }
    }
    return [-1, -1];
}
function handleKeyDown(event) {
    const currentTime = new Date().getTime() / 1000;
    if (currentTime - lastActionTime < 1)
        return;
    lastActionTime = currentTime;
    const focusedTroop = players[0].selectedTroop();
    // move troop
    if (event.key == "ArrowLeft") {
        if (moveTroop(focusedTroop, -1, 0))
            playerAction();
    }
    else if (event.key == "ArrowRight") {
        if (moveTroop(focusedTroop, +1, 0))
            playerAction();
    }
    else if (event.key == "ArrowUp") {
        if (moveTroop(focusedTroop, 0, -1))
            playerAction();
    }
    else if (event.key == "ArrowDown") {
        if (moveTroop(focusedTroop, 0, +1))
            playerAction();
    }
    // modify tile
    else if (event.key == " ") {
        board[focusedTroop.y][focusedTroop.x].modified = !board[focusedTroop.y][focusedTroop.x].modified;
        socket.send(`modify-tile ${focusedTroop.x} ${focusedTroop.y}`);
        if (board[focusedTroop.y][focusedTroop.x].type === WATER || board[focusedTroop.y][focusedTroop.x].type === OCEAN)
            focusedTroop.isOnShip = !focusedTroop.isOnShip;
        playerAction();
    }
}
async function handleKeyControl(event) {
    if (event.key == "t") {
        players[0].selectedTroopIndex++;
        if (players[0].selectedTroopIndex >= players[0].troops.length)
            players[0].selectedTroopIndex = 0;
        turnHappened = true;
    }
    if (event.key == "m") {
        seed = Math.random() * 1e9;
        generateMap();
    }
    if (event.key == "1") {
        MAP_LENGTH = Math.max(1, MAP_LENGTH - 1);
        console.log("Map length = " + MAP_LENGTH);
        socket.send(`update-map ${MAP_LENGTH} ${CHUNK_SIZE}`);
        generateMap();
    }
    if (event.key == "2") {
        MAP_LENGTH++;
        console.log("Map length = " + MAP_LENGTH);
        board.push([]);
        socket.send(`update-map ${MAP_LENGTH} ${CHUNK_SIZE}`);
        generateMap();
    }
    if (event.key == "9") {
        CHUNK_SIZE = Math.max(1, CHUNK_SIZE - (0.1 + Math.random() * 0.02));
        socket.send(`update-map ${MAP_LENGTH} ${CHUNK_SIZE}`);
        generateMap();
    }
    if (event.key == "0") {
        CHUNK_SIZE += (0.1 + Math.random() * 0.02);
        socket.send(`update-map ${MAP_LENGTH} ${CHUNK_SIZE}`);
        generateMap();
    }
    if (event.key == "g") {
        const l = recievedMessages.length;
        socket.send(`generate-map ${MAP_LENGTH} ${CHUNK_SIZE}`);
        while (recievedMessages.length == l) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        const parts = recievedMessages[l].split(" ");
        [CHUNK_SIZE, seed] = [parseFloat(parts[2]), parseFloat(parts[3])];
        generateMap();
    }
}
function handleMouseDown(_event) {
    if (pickedData[2] == 0)
        return;
    const currentTime = new Date().getTime() / 1000;
    if (currentTime - lastActionTime < 1)
        return;
    lastActionTime = currentTime;
    const [x, y] = [pickedData[0], pickedData[1]];
    const res = tileHasTroop(x, y);
    const currentPlayer = players[0];
    turnHappened = true;
    // if there's no troop, try to move currently selected troop, otherwise add a troop
    if (res[0] === -1) {
        const selectedTroop = currentPlayer.selectedTroop();
        const troopMoved = moveTroop(selectedTroop, x - selectedTroop.x, y - selectedTroop.y);
        if (!troopMoved) {
            currentPlayer.addTroop(x, y);
            currentPlayer.selectedTroopIndex = currentPlayer.troops.length - 1;
        }
    }
    else if (res[0] != 0) {
        return;
    }
    // otherwise, modify the tile or change troop focus
    else { // if (res[0] == playerTurn)
        if (currentPlayer.selectedTroopIndex == res[1]) {
            board[y][x].modified = !board[y][x].modified;
            socket.send(`modify-tile ${x} ${y}`);
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
    turnHappened = true;
}
function mouseDown_beginning(_event) {
    if (pickedData[2] == 0)
        return;
    const [x, y] = [pickedData[0], pickedData[1]];
    const res = tileHasTroop(x, y);
    // if there is a troop on this tile, don't do anything
    if (res[0] !== -1)
        return;
    // check for nearby opponent troops
    for (let i = 1; i < players.length; i++) {
        for (let j = 0; j < players[i].troops.length; j++) {
            const otherTroop = players[i].troops[j];
            // too close to enemy troop
            if (Math.abs(x - otherTroop.x) + Math.abs(y - otherTroop.y) <= 3)
                return;
        }
    }
    const tileType = board[y][x].type;
    if (tileType === VOLCANO || tileType === WATER || tileType === OCEAN)
        return;
    players[0].addTroop(x, y);
    moves++;
    if (moves === NUMBER_OF_STARTING_TROOPS) {
        removeEventListener("mousedown", mouseDown_beginning);
        addEventListener("mousedown", handleMouseDown);
        addEventListener("keydown", handleKeyDown);
        moves = 0;
        console.log("end of beginning stage");
    }
}
try {
    players.push(new Player(), new Player());
    addEventListener("mousedown", mouseDown_beginning);
    addEventListener("keydown", handleKeyControl);
    // initialize board
    for (let i = 0; i < MAP_LENGTH; i++)
        board.push([]);
    seed = Math.random() * 1e9;
    generateMap();
    init(drawBoardInstanced);
}
catch (e) {
    console.log(`Uncaught JavaScript exception: ${e}`);
}
