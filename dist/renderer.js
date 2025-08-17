/** TODO
 * -------
 * Update import code for assets, currently strange implementation
 * improve picking (optimization, etc)
 * Optimize (combine) matrix code in GamePiece.draw()
 * Add settings to configure effects
 *      - floating in the sky effect
 *      - troop movement animations
 *      - FPS
 */
import { m4 } from "./m4.js";
import { OBJFile } from "./OBJFile.js";
import { MAP_LENGTH, ASSET_NAMES } from "./boredgame.js";
const MM_TO_IN = 1 / 25.4;
const lightDirection = normalize([0.5, 0.7, 1]);
let gl;
let canvas;
let aspectRatio;
let matrixInstancedLoc;
let brightnessAttribLoc;
let diffuseUniformInstanced;
let lightDirectionUniformInstanced;
let baseMatrix;
let matrixPickingAttribLoc;
let idAttribLoc;
let [mouseX, mouseY] = [-1, -1];
let isPicking;
export let pickedData = new Uint8Array(4);
function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    // Check if the canvas is not the same size.
    const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
    if (needResize) {
        // Make the canvas the same size
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        aspectRatio = canvas.clientWidth / canvas.clientHeight;
        baseMatrix = m4.orthographic(-1, 1, -1 / aspectRatio, 1 / aspectRatio, -1, 1);
        baseMatrix = m4.xRotate(baseMatrix, Math.PI / 6);
        baseMatrix = m4.yRotate(baseMatrix, Math.PI / 4);
    }
    return needResize;
}
export class GamePiece {
    vao;
    pickingVao;
    numVerticies;
    diffuse;
    constructor(vao, pickingVao, numVerticies, diffuse) {
        this.vao = vao;
        this.pickingVao = pickingVao;
        this.numVerticies = numVerticies;
        this.diffuse = diffuse;
    }
    drawMultiple(numInstances, xPositions, yPositions, time, fade, rotation) {
        if (numInstances == 0)
            return;
        gl.bindVertexArray(isPicking ? this.pickingVao : this.vao);
        let positionMatrix = m4.scaleUniformly(baseMatrix, 35 / MAP_LENGTH);
        positionMatrix = m4.translate(positionMatrix, 0, 0.005 * Math.sin(time), 0);
        const matrixData = new Float32Array(numInstances * 16);
        for (let i = 0; i < numInstances; i++) {
            let specificMatrix = m4.translate(positionMatrix, MM_TO_IN * (xPositions[i] - (MAP_LENGTH - 1) / 2), 0, MM_TO_IN * (yPositions[i] - (MAP_LENGTH - 1) / 2));
            specificMatrix = m4.yRotate(specificMatrix, rotation[i]);
            for (let j = 0; j < 16; j++) {
                matrixData[i * 16 + j] = specificMatrix[j];
            }
        }
        const matrixBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, matrixData, gl.STATIC_DRAW);
        const bytesPerMatrix = 4 * 16;
        for (let i = 0; i < 4; i++) {
            const loc = i + (isPicking ? matrixPickingAttribLoc : matrixInstancedLoc);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, bytesPerMatrix, i * 16);
            gl.vertexAttribDivisor(loc, 1);
        }
        if (isPicking) {
            const idArray = new Float32Array(4 * numInstances);
            for (let i = 0; i < numInstances; i++) {
                idArray[i * 4] = (xPositions[i] & 0xff) / 0xff;
                idArray[i * 4 + 1] = (yPositions[i] & 0xff) / 0xff;
                idArray[i * 4 + 2] = (1 & 0xff) / 0xff;
                // idArray[i * 4 + 3] = (0 & 0xff) / 0xff;
            }
            const idBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, idBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, idArray, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(idAttribLoc);
            gl.vertexAttribPointer(idAttribLoc, 4, gl.FLOAT, false, 0, 0);
            gl.vertexAttribDivisor(idAttribLoc, 1);
        }
        else {
            gl.uniform3fv(diffuseUniformInstanced, this.diffuse);
            const brightnessArray = new Float32Array(numInstances);
            const fadeMultiplier = 0.95 + Math.abs(0.3 * Math.sin(2 * time));
            for (let i = 0; i < numInstances; i++) {
                if (fade[i] || (pickedData[0] == xPositions[i] && pickedData[1] == yPositions[i] && pickedData[2] == 1))
                    brightnessArray[i] = fadeMultiplier;
                else
                    brightnessArray[i] = 1;
            }
            const brightnessBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, brightnessBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, brightnessArray, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(brightnessAttribLoc);
            gl.vertexAttribPointer(brightnessAttribLoc, 1, gl.FLOAT, false, 0, 0);
            gl.vertexAttribDivisor(brightnessAttribLoc, 1);
        }
        gl.drawArraysInstanced(gl.TRIANGLES, 0, this.numVerticies, numInstances);
    }
}
const vertexShaderSourceInstanced = `#version 300 es
    precision mediump float;

    in vec4 a_position;
    in vec3 a_normal;

    in mat4 a_matrix;
    in float a_brightness;

    out vec3 v_normal;
    out float v_brightness;

    void main() {
        gl_Position = a_matrix * a_position;

        v_normal = a_normal;
        v_brightness = a_brightness;

    }
`;
const fragmentShaderSourceInstanced = `#version 300 es
    precision mediump float;

    in vec3 v_normal;
    in float v_brightness;

    uniform vec3 u_diffuse;
    uniform vec3 u_lightDirection;

    out vec4 outputColor;

    void main() {
        float light = dot(u_lightDirection, v_normal) * .5 + .5;
        outputColor = vec4(u_diffuse.rgb * light * v_brightness, 1.0);
    }
`;
const pickingVS = `#version 300 es
    in vec4 a_position;

    in mat4 a_matrix;
    in vec4 a_id;

    out vec4 v_id;

    void main() {
        gl_Position = a_matrix * a_position;

        v_id = a_id;
    }
`;
const pickingFS = `#version 300 es
    precision highp float;

    in vec4 v_id;

    out vec4 outColor;

    void main() {
        outColor = v_id;
    }
`;
function getContext(canvas) {
    const gl = canvas.getContext("webgl2");
    if (!gl) {
        throw new Error("WebGL2 is unsupported - try another browser or device");
    }
    return gl;
}
function createStaticVertexBuffer(gl, data) {
    const buffer = gl.createBuffer();
    if (!buffer) {
        throw new Error("Failed to allocate buffer");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
}
function getUniformLocation(program, name) {
    const loc = gl.getUniformLocation(program, name);
    if (loc === null) {
        throw new Error(`Uniform location ${name} is null`);
    }
    return loc;
}
function getAttribLocation(program, name) {
    const loc = gl.getAttribLocation(program, name);
    if (loc < 0) {
        throw new Error(`Failed to get attribute location ${name}`);
    }
    return loc;
}
function createInterleavedBufferVao(gl, interleavedBuffer, positionAttribLocation, normalAttribLocation) {
    const vao = gl.createVertexArray();
    if (!vao) {
        throw new Error("Failed to allocate VAO for two buffers");
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
function createBufferVao(gl, buffer, positionAttribLocation) {
    const vao = gl.createVertexArray();
    if (!vao) {
        throw new Error("Failed to allocate VAO for two buffers");
    }
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(positionAttribLocation, 3, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    return vao;
}
function normalize(arr) {
    let squareSum = 0;
    for (let i = 0; i < arr.length; i++)
        squareSum += arr[i] * arr[i];
    const magnitude = Math.sqrt(squareSum);
    const normalized = [];
    for (let i = 0; i < arr.length; i++)
        normalized.push(arr[i] / magnitude);
    return normalized;
}
function getCanvas(document) {
    const canvas = document.getElementById("canvas");
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error("Failed to get gl canvas reference");
    }
    return canvas;
}
async function importModel(assetName, vertexPosAttrib, vertexNormAttrib, vertPosPickingAttrib) {
    try {
        const assetObj = await fetch(`/assets/${assetName}.obj`);
        const objResponse = await assetObj.text();
        const obj = new OBJFile(objResponse, assetName);
        const objContents = obj.parse();
        // const assetMtl = await fetch(`/assets/${objContents.materialLibraries}`);
        // const mtlResponse = await assetMtl.text();
        const assetModels = objContents.models;
        const assetVertices = assetModels[0].vertices;
        const assetNormals = assetModels[0].vertexNormals;
        // const assetTextures = assetModels[0].textureCoords;
        const interleavedData = [];
        const vertexData = [];
        for (let i = 0; i < assetModels.length; i++) {
            const assetFaces = assetModels[i].faces;
            for (let j = 0; j < assetFaces.length; j++) {
                const face = assetFaces[j];
                for (let k = 0; k < 3; k++) { // only works for faces with 3 verticies
                    const assetVertex = assetVertices[face.vertices[k].vertexIndex - 1];
                    const assetNormal = assetNormals[face.vertices[k].vertexNormalIndex - 1];
                    interleavedData.push(assetVertex.x, assetVertex.y, assetVertex.z, assetNormal.x, assetNormal.y, assetNormal.z);
                    vertexData.push(assetVertex.x, assetVertex.y, assetVertex.z);
                }
            }
        }
        const dataBuffer = createStaticVertexBuffer(gl, new Float32Array(interleavedData));
        const assetVao = createInterleavedBufferVao(gl, dataBuffer, vertexPosAttrib, vertexNormAttrib);
        const pickingDataBuffer = createStaticVertexBuffer(gl, new Float32Array(vertexData));
        const pickingVao = createBufferVao(gl, pickingDataBuffer, vertPosPickingAttrib);
        // hacky implementation that works only for these models??
        // the material names(?) include the diffuse values that I need
        const material = assetModels[1].faces[0].material;
        const diffuseStrings = material.split("_");
        const diffuse = [
            parseFloat(diffuseStrings[0]),
            parseFloat(diffuseStrings[1]),
            parseFloat(diffuseStrings[2])
        ];
        return new GamePiece(assetVao, pickingVao, interleavedData.length / 6, diffuse);
    }
    catch (e) {
        const errMessage = `Failed to import model ${assetName}: ${e}`;
        throw new Error(errMessage);
    }
}
function compileProgram(vertexShaderSource, fragmentShaderSource) {
    // compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (vertexShader === null) {
        throw new Error("Could not allocate vertex shader");
    }
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(vertexShader);
        throw new Error(`Failed to compile VS - ${compileError}`);
    }
    // compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (fragmentShader === null) {
        throw new Error("Could not allocate fragment shader");
    }
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(fragmentShader);
        throw new Error(`Failed to compile FS - ${compileError}`);
    }
    // link shaders
    const program = gl.createProgram();
    if (program === null) {
        throw new Error("Could not allocate program");
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const linkError = gl.getProgramInfoLog(program);
        throw new Error(`Failed to link shaders - ${linkError}`);
    }
    return program;
}
export async function init(drawBoardInstanced) {
    canvas = getCanvas(document);
    gl = getContext(canvas);
    const fpsElement = document.querySelector("#fps");
    const fpsNode = document.createTextNode("");
    if (fpsElement == null) {
        throw new Error("fps element not found");
    }
    fpsElement.appendChild(fpsNode);
    gl.canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });
    // Instanced drawing setup
    const instancedProgram = compileProgram(vertexShaderSourceInstanced, fragmentShaderSourceInstanced);
    const vertexPositionAttributeLocation = getAttribLocation(instancedProgram, 'a_position');
    const vertexNormalAttributeLocation = getAttribLocation(instancedProgram, 'a_normal');
    matrixInstancedLoc = getAttribLocation(instancedProgram, 'a_matrix');
    brightnessAttribLoc = getAttribLocation(instancedProgram, 'a_brightness');
    lightDirectionUniformInstanced = getUniformLocation(instancedProgram, 'u_lightDirection');
    diffuseUniformInstanced = getUniformLocation(instancedProgram, 'u_diffuse');
    // Picking texture setup **************************************************
    // Create a texture to render to
    const targetTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // create a depth renderbuffer
    const depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    function setFramebufferAttachmentSizes(width, height) {
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        // define size and format of level 0
        const level = 0;
        gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    }
    // Create and bind the framebuffer
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    // attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    const level = 0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);
    // make a depth buffer and the same size as the targetTexture
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
    const pickingProgram = compileProgram(pickingVS, pickingFS);
    const vertexPositionPickingAttribLoc = getAttribLocation(pickingProgram, 'a_position');
    matrixPickingAttribLoc = getAttribLocation(pickingProgram, 'a_matrix');
    idAttribLoc = getAttribLocation(pickingProgram, 'a_id');
    // end picking texture setup *************************************************
    // Import models asynchronously
    const gamePieces = await Promise.all(ASSET_NAMES.map((assetName) => importModel(assetName, vertexPositionAttributeLocation, vertexNormalAttributeLocation, vertexPositionPickingAttribLoc)));
    gl.enable(gl.DEPTH_TEST);
    let lastTime = Date.now();
    let numFrames = 0;
    async function render(time) {
        time *= 0.001; // convert to seconds
        const startTime = Date.now();
        if (resizeCanvasToDisplaySize(gl.canvas))
            setFramebufferAttachmentSizes(gl.canvas.width, gl.canvas.height);
        // Draw to texture ***********************************************
        isPicking = true;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.useProgram(pickingProgram);
        drawBoardInstanced(gamePieces, time);
        // Read pixel under cursor ***************************************
        if (!(gl.canvas instanceof HTMLCanvasElement)) {
            throw new Error("gl.canvas is not HTMLCanvasElement");
        }
        const pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
        const pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
        gl.readPixels(pixelX, // x
        pixelY, // y
        1, // width
        1, // height
        gl.RGBA, // format
        gl.UNSIGNED_BYTE, // type
        pickedData); // typed array to hold result
        // Draw to canvas ************************************************
        isPicking = false;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // sky blue background
        gl.clearColor(0.53, 0.81, 0.92, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(instancedProgram);
        gl.uniform3fv(lightDirectionUniformInstanced, lightDirection);
        drawBoardInstanced(gamePieces, time);
        numFrames++;
        const endTime = Date.now();
        if (endTime - lastTime >= 1000) {
            fpsNode.nodeValue = `${numFrames}`;
            lastTime = endTime;
            numFrames = 0;
        }
        await new Promise((resolve) => setTimeout(resolve, 30 - (endTime - startTime)));
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
