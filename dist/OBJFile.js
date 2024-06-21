// slightly modified from https://github.com/Deckeraga/obj-file-parser-ts/
export class OBJFile {
    fileContents;
    defaultModelName = 'untitled';
    currentMaterial = '';
    currentGroup = '';
    smoothingGroup = 0;
    result = {
        materialLibraries: [],
        models: [],
    };
    constructor(fileContents, defaultModelName) {
        this.fileContents = fileContents;
        if (defaultModelName !== undefined) {
            this.defaultModelName = defaultModelName;
        }
    }
    parseAsync() {
        return new Promise((resolve, reject) => {
            try {
                resolve(this.parse());
            }
            catch (error) {
                reject(error);
            }
        });
    }
    parse() {
        const stripComments = (line) => {
            const commentIndex = line.indexOf('#');
            return commentIndex > -1 ? line.substring(0, commentIndex) : line;
        };
        const lines = this.fileContents.split('\n');
        for (const line of lines) {
            const strippedLine = stripComments(line);
            const lineItems = strippedLine
                .replace(/\s\s+/g, ' ')
                .trim()
                .split(' ');
            switch (lineItems[0].toLowerCase()) {
                case 'o':
                    this.parseObject(lineItems);
                    break;
                case 'g':
                    this.parseGroup(lineItems);
                    break;
                case 'v':
                    this.parseVertexCoords(lineItems);
                    break;
                case 'vt':
                    this.parseTextureCoords(lineItems);
                    break;
                case 'vn':
                    this.parseVertexNormal(lineItems);
                    break;
                case 's':
                    this.parseSmoothShadingStatement(lineItems);
                    break;
                case 'f':
                    this.parsePolygon(lineItems);
                    break;
                case 'mtllib':
                    this.parseMtlLib(lineItems);
                    break;
                case 'usemtl':
                    this.parseUseMtl(lineItems);
                    break;
                default:
                    // Handle unrecognized line types if needed
                    break;
            }
        }
        return this.result;
    }
    currentModel() {
        if (this.result.models.length === 0) {
            this.result.models.push({
                faces: [],
                name: this.defaultModelName,
                textureCoords: [],
                vertexNormals: [],
                vertices: [],
            });
            this.currentGroup = '';
            this.smoothingGroup = 0;
        }
        return this.result.models[this.result.models.length - 1];
    }
    parseObject(lineItems) {
        const modelName = lineItems.length >= 2 ? lineItems[1] : this.defaultModelName;
        this.result.models.push({
            faces: [],
            name: modelName,
            textureCoords: [],
            vertexNormals: [],
            vertices: [],
        });
        this.currentGroup = '';
        this.smoothingGroup = 0;
    }
    parseGroup(lineItems) {
        if (lineItems.length !== 2) {
            throw new Error('Group statements must have exactly 1 argument (e.g., g group_1)');
        }
        this.currentGroup = lineItems[1];
    }
    parseVertexCoords(lineItems) {
        const x = lineItems.length >= 2 ? parseFloat(lineItems[1]) : 0.0;
        const y = lineItems.length >= 3 ? parseFloat(lineItems[2]) : 0.0;
        const z = lineItems.length >= 4 ? parseFloat(lineItems[3]) : 0.0;
        this.currentModel().vertices.push({ x, y, z });
    }
    parseTextureCoords(lineItems) {
        const u = lineItems.length >= 2 ? parseFloat(lineItems[1]) : 0.0;
        const v = lineItems.length >= 3 ? parseFloat(lineItems[2]) : 0.0;
        const w = lineItems.length >= 4 ? parseFloat(lineItems[3]) : 0.0;
        this.currentModel().textureCoords.push({ u, v, w });
    }
    parseVertexNormal(lineItems) {
        const x = lineItems.length >= 2 ? parseFloat(lineItems[1]) : 0.0;
        const y = lineItems.length >= 3 ? parseFloat(lineItems[2]) : 0.0;
        const z = lineItems.length >= 4 ? parseFloat(lineItems[3]) : 0.0;
        this.currentModel().vertexNormals.push({ x, y, z });
    }
    parsePolygon(lineItems) {
        const totalVertices = lineItems.length - 1;
        if (totalVertices < 3) {
            throw new Error('Face statement has fewer than 3 vertices');
        }
        const face = {
            group: this.currentGroup,
            material: this.currentMaterial,
            smoothingGroup: this.smoothingGroup,
            vertices: [],
        };
        for (let i = 0; i < totalVertices; i += 1) {
            const vertexString = lineItems[i + 1];
            const vertexValues = vertexString.split('/');
            if (vertexValues.length < 1 || vertexValues.length > 3) {
                throw new Error('Too many values (separated by /) for a single vertex');
            }
            let vertexIndex = 0;
            let textureCoordsIndex = 0;
            let vertexNormalIndex = 0;
            vertexIndex = parseInt(vertexValues[0], 10);
            if (vertexValues.length > 1 && vertexValues[1] !== '') {
                textureCoordsIndex = parseInt(vertexValues[1], 10);
            }
            if (vertexValues.length > 2) {
                vertexNormalIndex = parseInt(vertexValues[2], 10);
            }
            if (vertexIndex === 0) {
                throw new Error('Face uses invalid vertex index of 0');
            }
            // Negative vertex indices refer to the nth last defined vertex
            // convert these to positive indices for simplicity
            if (vertexIndex < 0) {
                vertexIndex = this.currentModel().vertices.length + 1 + vertexIndex;
            }
            face.vertices.push({
                textureCoordsIndex,
                vertexIndex,
                vertexNormalIndex,
            });
        }
        this.currentModel().faces.push(face);
    }
    parseMtlLib(lineItems) {
        if (lineItems.length >= 2) {
            this.result.materialLibraries.push(lineItems[1]);
        }
    }
    parseUseMtl(lineItems) {
        if (lineItems.length >= 2) {
            this.currentMaterial = lineItems[1];
        }
    }
    parseSmoothShadingStatement(lineItems) {
        if (lineItems.length !== 2) {
            throw new Error('Smoothing group statements must have exactly 1 argument (e.g., s <number|off>)');
        }
        const groupNumber = lineItems[1].toLowerCase() === 'off' ? 0 : parseInt(lineItems[1], 10);
        this.smoothingGroup = groupNumber;
    }
}
