/** TODO
 * -------
 * Update import code for assets, currently strange implementation
 * Use MTL files?
 * Panning & Zooming
 * Picking game pieces
 */
import { m4 } from "./m4.js";
import { OBJFile } from "./OBJFile.js";
import { MAP_LENGTH, ASSET_NAMES } from "./boredgame.js";
let gl;
let matrixUniform;
let lightDirectionUniform;
let diffuseUniform;
let canvas;
let aspectRatio;
function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    // Check if the canvas is not the same size.
    const needResize = canvas.width !== displayWidth ||
        canvas.height !== displayHeight;
    if (needResize) {
        // Make the canvas the same size
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
    return needResize;
}
export class GamePiece {
    vao;
    numVerticies;
    diffuse;
    constructor(vao, numVerticies, diffuse) {
        this.vao = vao;
        this.numVerticies = numVerticies;
        this.diffuse = diffuse;
    }
    draw(xPosition, yPosition, time, fade) {
        gl.bindVertexArray(this.vao);
        // let matrix = m4.orthographic(-aspectRatio, aspectRatio, -1, 1, -1, 1);
        let matrix = m4.orthographic(-1, 1, -1 / aspectRatio, 1 / aspectRatio, -1, 1);
        matrix = m4.scaleUniformly(matrix, 35 / MAP_LENGTH);
        // isometric view
        matrix = m4.xRotate(matrix, Math.PI / 6);
        matrix = m4.yRotate(matrix, Math.PI / 4);
        // floating in the sky effect
        matrix = m4.translate(matrix, 0, 0.005 * Math.sin(time), 0);
        // earthquake effect 
        // matrix = m4.translate(matrix, 0, 0.005*Math.random(), 0);
        matrix = m4.translate(matrix, 0.04 * (xPosition - ((MAP_LENGTH - 1) / 2)), 0, 0.04 * (yPosition - ((MAP_LENGTH - 1) / 2)));
        // changing color brightness
        if (fade) {
            const d = [];
            // fade brightness
            this.diffuse.forEach((diffuseValue) => {
                d.push(diffuseValue * (.95 + Math.abs(.3 * Math.sin(2 * time))));
            });
            gl.uniform3fv(diffuseUniform, d);
        }
        else {
            gl.uniform3fv(diffuseUniform, this.diffuse);
        }
        gl.uniformMatrix4fv(matrixUniform, false, matrix);
        gl.drawArrays(gl.TRIANGLES, 0, this.numVerticies);
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
/** Display an error message to the DOM, beneath the demo element */
export function showError(errorText) {
    console.error(errorText);
    const errorBoxDiv = document.getElementById('error-box');
    if (errorBoxDiv === null)
        return;
    const errorElement = document.createElement('p');
    errorElement.innerText = errorText;
    errorBoxDiv.appendChild(errorElement);
    console.log(errorText);
}
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
function getUniformLocation(program, name) {
    const loc = gl.getUniformLocation(program, name);
    if (loc === null) {
        showError(`Uniform location ${name} is null`);
        throw new Error(`Uniform location ${name} is null`);
    }
    return loc;
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
function getCanvas(document) {
    const canvas = document.getElementById('canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Failed to get gl canvas reference');
    }
    return canvas;
}
export async function init(drawBoard) {
    canvas = getCanvas(document);
    gl = getContext(canvas);
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
    matrixUniform = getUniformLocation(program, 'u_matrix');
    lightDirectionUniform = getUniformLocation(program, 'u_lightDirection');
    diffuseUniform = getUniformLocation(program, 'u_diffuse');
    const gamePieces = [];
    // Import models
    for (let i = 0; i < ASSET_NAMES.length; i++) {
        try {
            const assetObj = await fetch(`/assets/${ASSET_NAMES[i]}.obj`);
            const objResponse = await assetObj.text();
            const obj = new OBJFile(objResponse, ASSET_NAMES[i]);
            const objContents = obj.parse();
            // const assetMtl = await fetch(`/assets/${objContents.materialLibraries}`);
            // const mtlResponse = await assetMtl.text();
            const assetModels = objContents.models;
            const assetVertices = assetModels[0].vertices;
            const assetNormals = assetModels[0].vertexNormals;
            // const assetTextures = assetModels[0].textureCoords;
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
                showError(`assetVao ${ASSET_NAMES[i]} is null`);
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
            const gp = new GamePiece(assetVao, interleavedData.length / 6, diffuse);
            gamePieces.push(gp);
        }
        catch (e) {
            showError(`Failed to import model ${ASSET_NAMES[i]}: ${e}`);
            return;
        }
    }
    async function render(time) {
        time *= 0.001; // convert to seconds
        resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        if (canvas === null)
            return;
        aspectRatio = canvas.clientWidth / canvas.clientHeight;
        gl.enable(gl.DEPTH_TEST);
        // sky blue background
        gl.clearColor(.53, .81, .92, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform3fv(lightDirectionUniform, normalize([.5, .7, 1]));
        drawBoard(gamePieces, time);
        await new Promise((resolve) => setTimeout(resolve, 30));
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
