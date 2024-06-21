import { m4 } from "./m4";
import { OBJFile } from "./OBJFile";
const MAP_WIDTH = 9;
const MAP_HEIGHT = 9;
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
})(TileType || (TileType = {}));
const assetNames = ['grass', 'forest', 'plains', 'mountain', 'volcano', 'water', 'coast', 'ocean', 'swamp', 'snow', 'soldierblue', 'port', 'lava', 'ship', 'castle'];
const { GRASS, FOREST, PLAINS, MOUNTAIN, VOLCANO, WATER, COAST, OCEAN, SWAMP, SNOW } = TileType;
const ISLAND_MAP = [
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
/** Display an error message to the DOM, beneath the demo element */
function showError(errorText) {
    console.error(errorText);
    const errorBoxDiv = document.getElementById('error-box');
    if (errorBoxDiv === null)
        return;
    const errorElement = document.createElement('p');
    errorElement.innerText = errorText;
    errorBoxDiv.appendChild(errorElement);
    console.log(errorText);
}
class GamePiece {
    pieceType;
    vao;
    numVerticies;
    diffuse;
    constructor(pieceType, vao, numVerticies, diffuse
    // data structure to hold model information
    ) {
        this.pieceType = pieceType;
        this.vao = vao;
        this.numVerticies = numVerticies;
        this.diffuse = diffuse;
    }
    draw(gl, xPosition, yPosition, matrixUniform, diffuseUniform, time) {
        gl.bindVertexArray(this.vao);
        let matrix = m4.orthographic(-.25, .25, -.25, .25, -1, 1);
        matrix = m4.xRotate(matrix, Math.PI / 6);
        matrix = m4.yRotate(matrix, Math.PI / 4);
        matrix = m4.translate(matrix, 0, 0.005 * Math.sin(time), 0);
        matrix = m4.translate(matrix, 0.04 * (xPosition - Math.floor(MAP_WIDTH / 2)), 0, 0.04 * (yPosition - Math.floor(MAP_HEIGHT / 2)));
        gl.uniform3fv(diffuseUniform, this.diffuse);
        gl.uniformMatrix4fv(matrixUniform, false, matrix);
        gl.drawArrays(gl.TRIANGLES, 0, this.numVerticies);
    }
}
class Tile extends GamePiece {
}
class Troop extends GamePiece {
    position;
    constructor(position) {
        super(0, [], 0, []);
        this.position = position;
    }
}
class Player {
    troops;
    constructor(troops) {
        this.troops = troops;
    }
}
const boardLayout = ISLAND_MAP;
/**
 *
 * @param gl
 */
function drawBoard(gl, gamePieces, matrixUniform, diffuseUniform, time) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const terrain = boardLayout[y][x];
            gamePieces[terrain].draw(gl, x, y, matrixUniform, diffuseUniform, time);
            if (terrain === VOLCANO) {
                gamePieces[12].draw(gl, x, y, matrixUniform, diffuseUniform, time);
            }
            else if (terrain === COAST)
                gamePieces[11].draw(gl, x, y, matrixUniform, diffuseUniform, time);
            else if (x == 7 && y == 7)
                gamePieces[13].draw(gl, x, y, matrixUniform, diffuseUniform, time);
            else if (x == 4 && y == 1)
                gamePieces[10].draw(gl, x, y, matrixUniform, diffuseUniform, time);
            else if (x == 1 && y == 3)
                gamePieces[14].draw(gl, x, y, matrixUniform, diffuseUniform, time);
        }
    }
}
const vertexShaderSource = `#version 300 es
    precision mediump float;

    in vec4 a_position;
    in vec3 a_normal;

    out vec3 v_normal;

    uniform mat4 u_matrix;

    void main() {
        gl_Position = u_matrix * a_position;

        v_normal = a_normal;
    }
`;
const fragmentShaderSource = `#version 300 es
    precision mediump float;
    
    in vec3 v_normal;
    uniform vec3 u_lightDirection;
    uniform vec3 u_diffuse;
    
    out vec4 outputColor;

    void main() {
        vec3 normal = normalize(v_normal);

        float light = dot(u_lightDirection, normal) * .5 + .5;

        outputColor = vec4(u_diffuse.rgb * light, 1.0);
    }
`;
function getContext(canvas) {
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL2 is unsupported - try another browser or device');
    }
    return gl;
}
function createStaticVertexBuffer(gl, data) {
    const buffer = gl.createBuffer();
    if (!buffer) {
        showError('Failed to allocate buffer');
        return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
}
function createInterleavedBufferVao(gl, interleavedBuffer, positionAttribLocation, normalAttribLocation) {
    const vao = gl.createVertexArray();
    if (!vao) {
        showError('Failed to allocate VAO for two buffers');
        return null;
    }
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.enableVertexAttribArray(normalAttribLocation);
    // Interleaved format (all float32)
    // (x, y, z, normX, normY, normZ), (x, y, z, normX, normY, normZ), ...
    gl.bindBuffer(gl.ARRAY_BUFFER, interleavedBuffer);
    gl.vertexAttribPointer(positionAttribLocation, 3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(normalAttribLocation, 3, gl.FLOAT, true, 6 * Float32Array.BYTES_PER_ELEMENT, // step
    3 * Float32Array.BYTES_PER_ELEMENT); // offset
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    return vao;
}
function normalize(arr) {
    let squareSum = 0;
    for (let i = 0; i < arr.length; i++)
        squareSum += arr[i] * arr[i];
    let magnitude = Math.sqrt(squareSum);
    const normalized = [];
    for (let i = 0; i < arr.length; i++)
        normalized.push(arr[i] / magnitude);
    return normalized;
}
async function boredgame() {
    const canvas = document.getElementById('canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Failed to get gl canvas reference');
    }
    const gl = getContext(canvas);
    // compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (vertexShader === null) {
        showError('Could not allocate vertex shader');
        return;
    }
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(vertexShader);
        showError(`Failed to COMPILE vertex shader - ${compileError}`);
        return;
    }
    // compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (fragmentShader === null) {
        showError('Could not allocate fragment shader');
        return;
    }
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(fragmentShader);
        showError(`Failed to COMPILE fragment shader - ${compileError}`);
        return;
    }
    // link shaders
    const program = gl.createProgram();
    if (program === null) {
        showError('Could not allocate program');
        return;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const linkError = gl.getProgramInfoLog(program);
        showError(`Failed to LINK shaders - ${linkError}`);
        return;
    }
    // Get attribute locations
    const vertexPositionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const vertexNormalAttributeLocation = gl.getAttribLocation(program, 'a_normal');
    if (vertexPositionAttributeLocation < 0 || vertexNormalAttributeLocation < 0) {
        showError(`Failed to get attribute locations:\n`
            + `pos=${vertexPositionAttributeLocation}\n`
            + `normal=${vertexNormalAttributeLocation}\n`);
        return;
    }
    // Get uniform locations
    const matrixUniform = gl.getUniformLocation(program, 'u_matrix');
    const lightDirectionUniform = gl.getUniformLocation(program, 'u_lightDirection');
    const diffuseUniform = gl.getUniformLocation(program, 'u_diffuse');
    if (matrixUniform === null || lightDirectionUniform === null || diffuseUniform === null) {
        showError(`Failed to get uniform locations:\n`
            + `matrixUniform=${!!matrixUniform}\n`
            + `lightDirectionUniform=${!!lightDirectionUniform}\n`
            + `diffuseUniform=${!!diffuseUniform}\n`);
        return;
    }
    const gamePieces = [];
    // Import models
    for (let i = 0; i < assetNames.length; i++) {
        console.log(`importing ${assetNames[i]}`);
        try {
            const assetObj = await fetch(`/assets/${assetNames[i]}.obj`);
            const objResponse = await assetObj.text();
            const obj = new OBJFile(objResponse, assetNames[i]);
            const objContents = obj.parse();
            console.log(objContents);
            // const assetMtl = await fetch(`/assets/${objContents.materialLibraries}`);
            // const mtlResponse = await assetMtl.text();
            const assetModels = objContents.models;
            const assetVertices = assetModels[0].vertices;
            const assetNormals = assetModels[0].vertexNormals;
            const assetTextures = assetModels[0].textureCoords;
            console.log(assetVertices.length + ' verticies');
            console.log(assetNormals.length + ' normals');
            const interleavedData = [];
            for (let j = 0; j < assetModels.length; j++) {
                const assetFaces = assetModels[j].faces;
                for (let k = 0; k < assetFaces.length; k++) {
                    const face = assetFaces[k];
                    for (let l = 0; l < 3; l++) { // will only work for faces with 3 verticies
                        const assetVertex = assetVertices[face.vertices[l].vertexIndex - 1];
                        const assetNormal = assetNormals[face.vertices[l].vertexNormalIndex - 1];
                        interleavedData.push(assetVertex.x, assetVertex.y, assetVertex.z, assetNormal.x, assetNormal.y, assetNormal.z);
                    }
                }
            }
            const dataBuffer = createStaticVertexBuffer(gl, new Float32Array(interleavedData));
            if (dataBuffer === null) {
                showError('Failed to create dataBuffer');
                return;
            }
            const assetVao = createInterleavedBufferVao(gl, dataBuffer, vertexPositionAttributeLocation, vertexNormalAttributeLocation);
            if (assetVao === null) {
                showError(`assetVao ${assetNames[i]} is null`);
                return;
            }
            // hacky implementation that works only for these models??
            // the material names(?) include the diffuse values that I need
            const material = assetModels[1].faces[0].material;
            const diffuseStrings = material.split('_');
            const diffuse = [
                parseFloat(diffuseStrings[0]),
                parseFloat(diffuseStrings[1]),
                parseFloat(diffuseStrings[2])
            ];
            const gp = new GamePiece(i, assetVao, interleavedData.length / 6, diffuse);
            gamePieces.push(gp);
        }
        catch (e) {
            showError(`Failed to import model ${assetNames[i]}: ${e}`);
            return;
        }
    }
    async function render(time) {
        time *= 0.001; // convert to seconds
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.enable(gl.DEPTH_TEST);
        // gl.enable(gl.CULL_FACE);
        gl.clearColor(.53, .81, .92, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform3fv(lightDirectionUniform, normalize([.5, .7, 1]));
        if (matrixUniform === null || diffuseUniform === null)
            return;
        drawBoard(gl, gamePieces, matrixUniform, diffuseUniform, time);
        await new Promise((resolve) => setTimeout(resolve, 25));
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
try {
    boredgame();
}
catch (e) {
    showError(`Uncaught JavaScript exception: ${e}`);
}
