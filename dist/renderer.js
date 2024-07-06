/** TODO
 * -------
 * Update import code for assets, currently strange implementation
 * Use MTL files?
 * Panning & Zooming
 * Optimize matrix code in GamePiece.draw()
 */
import { m4 } from "./m4.js";
import { OBJFile } from "./OBJFile.js";
import { MAP_LENGTH, ASSET_NAMES } from "./boredgame.js";
const MM_TO_IN = 0.0393700787;
let gl;
let canvas;
let aspectRatio;
let matrixUniform;
let lightDirectionUniform;
let diffuseUniform;
let matrixPickingUniform;
let idUniform;
let [mouseX, mouseY] = [-1, -1];
let isPicking;
let index = 0;
let pickedID = 0;
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
        aspectRatio = canvas.clientWidth / canvas.clientHeight;
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
        matrix = m4.translate(matrix, MM_TO_IN * (xPosition - ((MAP_LENGTH - 1) / 2)), 0, MM_TO_IN * (yPosition - ((MAP_LENGTH - 1) / 2)));
        ++index;
        if (isPicking) {
            gl.uniformMatrix4fv(matrixPickingUniform, false, matrix);
            gl.uniform4fv(idUniform, [
                ((index >> 0) & 0xFF) / 0xFF,
                ((index >> 8) & 0xFF) / 0xFF,
                ((index >> 16) & 0xFF) / 0xFF,
                ((index >> 24) & 0xFF) / 0xFF
            ]);
        }
        else {
            gl.uniformMatrix4fv(matrixUniform, false, matrix);
            // changing color brightness
            if (fade || index == pickedID) {
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
        }
        gl.drawArrays(gl.TRIANGLES, 0, this.numVerticies);
    }
}
const vertexShaderSource = `#version 300 es
    precision mediump float;

    in vec4 a_position;
    in vec3 a_normal;
    
    uniform mat4 u_matrix;
    
    out vec3 v_normal;

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
const pickingVS = `#version 300 es
    in vec4 a_position;

    uniform mat4 u_matrix;

    void main() {
        // Multiply the position by the matrix.
        gl_Position = u_matrix * a_position;
    }
`;
const pickingFS = `#version 300 es
    precision highp float;

    uniform vec4 u_id;

    out vec4 outColor;

    void main() {
        outColor = u_id;
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
async function importModel(assetName, vertexPosAttrib, vertexNormAttrib) {
    let gamePiece;
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
        for (let i = 0; i < assetModels.length; i++) {
            const assetFaces = assetModels[i].faces;
            for (let j = 0; j < assetFaces.length; j++) {
                const face = assetFaces[j];
                for (let k = 0; k < 3; k++) { // only works for faces with 3 verticies
                    const assetVertex = assetVertices[face.vertices[k].vertexIndex - 1];
                    const assetNormal = assetNormals[face.vertices[k].vertexNormalIndex - 1];
                    interleavedData.push(assetVertex.x, assetVertex.y, assetVertex.z, assetNormal.x, assetNormal.y, assetNormal.z);
                }
            }
        }
        const dataBuffer = createStaticVertexBuffer(gl, new Float32Array(interleavedData));
        if (dataBuffer === null) {
            showError('Failed to create dataBuffer');
            return;
        }
        const assetVao = createInterleavedBufferVao(gl, dataBuffer, vertexPosAttrib, vertexNormAttrib);
        if (assetVao === null) {
            showError(`assetVao ${assetName} is null`);
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
        gamePiece = new GamePiece(assetVao, interleavedData.length / 6, diffuse);
    }
    catch (e) {
        showError(`Failed to import model ${assetName}: ${e}`);
        throw new Error(`Could not import model ${assetName}: ${e}`);
    }
    return gamePiece;
}
function compileProgram(vertexShaderSource, fragmentShaderSource) {
    // compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (vertexShader === null) {
        showError('Could not allocate vertex shader');
        throw new Error('Could not allocate vertex shader');
    }
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(vertexShader);
        showError(`Failed to COMPILE vertex shader - ${compileError}`);
        throw new Error('Failed to compile VS');
        ;
    }
    // compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (fragmentShader === null) {
        showError('Could not allocate fragment shader');
        throw new Error('Could not allocate fragment shader');
        ;
    }
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(fragmentShader);
        showError(`Failed to COMPILE fragment shader - ${compileError}`);
        throw new Error('Failed to compile FS');
        ;
    }
    // link shaders
    const program = gl.createProgram();
    if (program === null) {
        showError('Could not allocate program');
        throw new Error('Could not allocate program');
        ;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const linkError = gl.getProgramInfoLog(program);
        showError(`Failed to LINK shaders - ${linkError}`);
        throw new Error('Failed to link shaders');
        ;
    }
    return program;
}
export async function init(drawBoard) {
    canvas = getCanvas(document);
    gl = getContext(canvas);
    gl.canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });
    const mainProgram = compileProgram(vertexShaderSource, fragmentShaderSource);
    // Get attribute locations
    const vertexPositionAttributeLocation = gl.getAttribLocation(mainProgram, 'a_position');
    const vertexNormalAttributeLocation = gl.getAttribLocation(mainProgram, 'a_normal');
    if (vertexPositionAttributeLocation < 0 || vertexNormalAttributeLocation < 0) {
        showError(`Failed to get attribute locations:\n`
            + `pos=${vertexPositionAttributeLocation}\n`
            + `normal=${vertexNormalAttributeLocation}\n`);
        return;
    }
    // Get uniform locations
    matrixUniform = getUniformLocation(mainProgram, 'u_matrix');
    lightDirectionUniform = getUniformLocation(mainProgram, 'u_lightDirection');
    diffuseUniform = getUniformLocation(mainProgram, 'u_diffuse');
    // Import models asynchronously
    const promises = ASSET_NAMES.map(async (assetName) => {
        const gamePiece = new Promise((resolve) => {
            setTimeout(() => resolve(importModel(assetName, vertexPositionAttributeLocation, vertexNormalAttributeLocation)), 5000);
        });
        return gamePiece;
    });
    const gamePieces = await Promise.all(promises);
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
    matrixPickingUniform = getUniformLocation(pickingProgram, 'u_matrix');
    idUniform = getUniformLocation(pickingProgram, 'u_id');
    // end picking texture setup *************************************************/
    gl.enable(gl.DEPTH_TEST);
    async function render(time) {
        time *= 0.001; // convert to seconds
        const start = Date.now();
        if (resizeCanvasToDisplaySize(gl.canvas))
            setFramebufferAttachmentSizes(gl.canvas.width, gl.canvas.height);
        // Draw to texture ***********************************************
        isPicking = true;
        index = 0;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.useProgram(pickingProgram);
        drawBoard(gamePieces, time);
        if (!(gl.canvas instanceof HTMLCanvasElement)) {
            throw new Error('gl.canvas is not HTMLCanvasElement');
        }
        const pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
        const pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
        const data = new Uint8Array(4);
        gl.readPixels(pixelX, // x
        pixelY, // y
        1, // width
        1, // height
        gl.RGBA, // format
        gl.UNSIGNED_BYTE, // type
        data); // typed array to hold result
        pickedID = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
        // Draw to canvas ************************************************
        isPicking = false;
        index = 0;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // sky blue background
        gl.clearColor(.53, .81, .92, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(mainProgram);
        gl.uniform3fv(lightDirectionUniform, normalize([.5, .7, 1]));
        drawBoard(gamePieces, time);
        await new Promise((resolve) => setTimeout(resolve, 25 - (Date.now() - start)));
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
