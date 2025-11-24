


//=== CAMERA ====================================================================================================================

var sphericalCamera = {
    camera: null,
//-------------------------------------------------------------------------------------------------------------------------------
    distance: 500,
    azimuth: 0,
    zenith: 90,
    init: function(aspectRatio) {
        sphericalCamera.camera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 2000)
    },
    update: function() {
        sphericalCamera.distance = Math.max(150, Math.min(sphericalCamera.distance, 1000));
        sphericalCamera.azimuth %= 360;
        sphericalCamera.zenith = Math.max(0.001, Math.min(sphericalCamera.zenith, 180));
        sphericalCamera.camera.position.set(
            Math.cos(sphericalCamera.azimuth / 180 * Math.PI) * Math.sin(sphericalCamera.zenith / 180 * Math.PI) * sphericalCamera.distance,
            Math.cos(sphericalCamera.zenith / 180 * Math.PI) * sphericalCamera.distance,
            Math.sin(sphericalCamera.azimuth / 180 * Math.PI) * Math.sin(sphericalCamera.zenith / 180 * Math.PI) * sphericalCamera.distance
        );
        sphericalCamera.camera.lookAt(new THREE.Vector3(0, 0, 0));
    }
};



//=== GEOCENTRIC COORDINATE TRANSLATOR ==========================================================================================

var geoCoordTranslator = {
    angleFromNoon: 0,
    equinoxLongitude: 0,
//-------------------------------------------------------------------------------------------------------------------------------
    currentTime: new Date(),
    angleFromEquinox: 0,
    update: function(currentTime) {
        geoCoordTranslator.currentTime = currentTime;
        var equinox = Date.UTC(geoCoordTranslator.currentTime.getUTCFullYear(), 2, 21, 12);
        var noon = Date.UTC(geoCoordTranslator.currentTime.getUTCFullYear(), geoCoordTranslator.currentTime.getUTCMonth(), geoCoordTranslator.currentTime.getUTCDate(), 12);
        var now = geoCoordTranslator.currentTime.getTime();
        geoCoordTranslator.angleFromEquinox = 2 * Math.PI * (now - equinox) / 31536000000;
        geoCoordTranslator.angleFromNoon = 2 * Math.PI * (now - noon) / 86400000;
        geoCoordTranslator.equinoxLongitude = geoCoordTranslator.angleFromEquinox - geoCoordTranslator.angleFromNoon;
    },
    g2c: function(point) {
        return new THREE.Vector3(
            point.x * Math.cos(geoCoordTranslator.equinoxLongitude) - point.y * Math.sin(geoCoordTranslator.equinoxLongitude),
            point.z,
            -point.x * Math.sin(geoCoordTranslator.equinoxLongitude) - point.y * Math.cos(geoCoordTranslator.equinoxLongitude)
        );
    }
};



//=== SATELLITE TRACKER =========================================================================================================

var satelliteTracker = {
    getEccAnomaly: function(eccentricity, meanMotion, meanAnomaly, time) {
        var curMeanAnomaly = (2 * Math.PI * meanMotion * time + meanAnomaly) % (2 * Math.PI);
        var eccAnomaly = curMeanAnomaly;
        for (var i = 0; i < 10; i++)
            eccAnomaly = eccAnomaly - (eccAnomaly - eccentricity * Math.sin(eccAnomaly) - curMeanAnomaly) / (1 - eccentricity * Math.cos(eccAnomaly));
        return eccAnomaly % (2 * Math.PI);
    },
    getTrueAnomaly: function(eccentricity, eccAnomaly) {
        return Math.atan2(Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccAnomaly), Math.cos(eccAnomaly) - eccentricity);
    },
    getDistance: function(semimajorAxis, eccentricity, eccAnomaly) {
        return semimajorAxis * (1 - eccentricity * Math.cos(eccAnomaly));
    },
//-------------------------------------------------------------------------------------------------------------------------------
    getSatellitePosition: function(keplerParams, timeOffset) {
        var time = (geoCoordTranslator.currentTime.getTime() - keplerParams.epoch.getTime()) / 1000 + timeOffset;
        var eccAnomaly = satelliteTracker.getEccAnomaly(keplerParams.eccentricity, keplerParams.meanMotion, keplerParams.meanAnomaly, time);
        var trueAnomaly = satelliteTracker.getTrueAnomaly(keplerParams.eccentricity, eccAnomaly);
        var distance = satelliteTracker.getDistance(keplerParams.semimajorAxis, keplerParams.eccentricity, eccAnomaly);
        var k = distance / 6371032 * 100;
        var deltaLon = -2 * geoCoordTranslator.angleFromEquinox;
        return new THREE.Vector3(
            k * (Math.cos(keplerParams.longitudeAscNode + deltaLon) * Math.cos(keplerParams.argPeriapsis + trueAnomaly) -
                 Math.sin(keplerParams.longitudeAscNode + deltaLon) * Math.sin(keplerParams.argPeriapsis + trueAnomaly) * Math.cos(keplerParams.inclination)),
            k * (Math.sin(keplerParams.longitudeAscNode + deltaLon) * Math.cos(keplerParams.argPeriapsis + trueAnomaly) +
                 Math.cos(keplerParams.longitudeAscNode + deltaLon) * Math.sin(keplerParams.argPeriapsis + trueAnomaly) * Math.cos(keplerParams.inclination)),
            k * Math.sin(keplerParams.argPeriapsis + trueAnomaly) * Math.sin(keplerParams.inclination)
        );
        //var xi = keplerParams.semimajorAxis * (Math.cos(eccAnomaly) - keplerParams.eccentricity) / 6371032 * 100;
        //var eta = keplerParams.semimajorAxis * Math.sqrt(1 - keplerParams.eccentricity * keplerParams.eccentricity) * Math.sin(eccAnomaly) / 6371032 * 100;
        //var P = new THREE.Vector3(
        //    Math.cos(keplerParams.longitudeAscNode + deltaLon) * Math.cos(keplerParams.argPeriapsis) - Math.sin(keplerParams.longitudeAscNode + deltaLon) * Math.sin(keplerParams.argPeriapsis) * Math.cos(keplerParams.inclination),
        //    Math.sin(keplerParams.longitudeAscNode + deltaLon) * Math.cos(keplerParams.argPeriapsis) + Math.cos(keplerParams.longitudeAscNode + deltaLon) * Math.sin(keplerParams.argPeriapsis) * Math.cos(keplerParams.inclination),
        //    Math.sin(keplerParams.argPeriapsis) * Math.sin(keplerParams.inclination)
        //);
        //var Q = new THREE.Vector3(
        //    -Math.cos(keplerParams.longitudeAscNode + deltaLon) * Math.sin(keplerParams.argPeriapsis) - Math.sin(keplerParams.longitudeAscNode + deltaLon) * Math.cos(keplerParams.argPeriapsis) * Math.cos(keplerParams.inclination),
        //    -Math.sin(keplerParams.longitudeAscNode + deltaLon) * Math.sin(keplerParams.argPeriapsis) + Math.cos(keplerParams.longitudeAscNode + deltaLon) * Math.cos(keplerParams.argPeriapsis) * Math.cos(keplerParams.inclination),
        //    Math.cos(keplerParams.argPeriapsis) * Math.sin(keplerParams.inclination)
        //);
        //return new THREE.Vector3(xi * P.x + eta * Q.x, xi * P.y + eta * Q.y, xi * P.z + eta * Q.z);
    }
}



//=== COLOR PICKER ==============================================================================================================

var colorPicker = {
    colors: ["red", "orange", "yellow", "lime", "cyan", "fuchsia"],
    actualColorIndex: 0,
//-------------------------------------------------------------------------------------------------------------------------------
    getActualColor: function() {
        return colorPicker.colors[colorPicker.actualColorIndex];
    },
    changeActualColor: function() {
        colorPicker.actualColorIndex = (colorPicker.actualColorIndex + 1) % colorPicker.colors.length;
    }
}



//=== SCENE MANAGER =============================================================================================================

var sceneManager = {
    scene: new THREE.Scene(),
    addSunMarker: function() {
        var s = new THREE.Mesh(new THREE.CubeGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0xffffff}));
        s.geoPosition = function() {
            return new THREE.Vector3(
                100 * Math.cos(geoCoordTranslator.angleFromEquinox),
                -100 * 0.917482 * Math.sin(geoCoordTranslator.angleFromEquinox),
                100 * 0.397777 * Math.sin(geoCoordTranslator.angleFromEquinox)
            )
        };
        sceneManager.scene.add(s);
    },
    addCMarkers: function() {
        var cX = new THREE.Mesh(new THREE.CubeGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0xff0000}));
        var cY = new THREE.Mesh(new THREE.CubeGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0x00ff00}));
        var cZ = new THREE.Mesh(new THREE.CubeGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0x0000ff}));
        cX.position.set(100, 0, 0);
        cY.position.set(0, 100, 0);
        cZ.position.set(0, 0, 100);
        sceneManager.scene.add(cX);
        sceneManager.scene.add(cY);
        sceneManager.scene.add(cZ);
    },
    addGMarkers: function() {
        var gX = new THREE.Mesh(new THREE.CubeGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
        var gY = new THREE.Mesh(new THREE.CubeGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0xff00ff}));
        var gZ = new THREE.Mesh(new THREE.CubeGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0xffff00}));
        gX.geoPosition = function() { return new THREE.Vector3(100, 0, 0); }
        gY.geoPosition = function() { return new THREE.Vector3(0, 100, 0); }
        gZ.geoPosition = function() { return new THREE.Vector3(0, 0, 100); }
        sceneManager.scene.add(gX);
        sceneManager.scene.add(gY);
        sceneManager.scene.add(gZ);
    },
    makeTextSprite: function(text) {
        var canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 100;
        var context = canvas.getContext("2d");
        context.font = "bold 14px Courier";
        context.fillStyle = colorPicker.getActualColor();
        context.fillText(text, 100 - 0.5 * context.measureText(text).width, 30);
        var tex = new THREE.Texture(canvas);
        tex.needsUpdate = true;
        var sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, useScreenCoordinates: false}));
        sprite.scale.set(30, 15, 0);
        return sprite;
    },
//-------------------------------------------------------------------------------------------------------------------------------
    init: function() {
        sceneManager.scene.add(new THREE.AmbientLight(0x606060));
        var sun = new THREE.DirectionalLight(0xcccccc, 1);
        sun.geoPosition = function() {
            return new THREE.Vector3(
                Math.cos(geoCoordTranslator.angleFromEquinox),
                -0.917482 * Math.sin(geoCoordTranslator.angleFromEquinox),
                0.397777 * Math.sin(geoCoordTranslator.angleFromEquinox)
            );
        };
        sceneManager.scene.add(sun);
        //sceneManager.addSunMarker();
        //sceneManager.addCMarkers();
        //sceneManager.addGMarkers();
        var planet = new THREE.Mesh(new THREE.SphereGeometry(100, 64, 64), MeshDayNightMaterial());
        sceneManager.scene.add(planet);
        var atmosphere = new THREE.Mesh(new THREE.SphereGeometry(101, 64, 64), MeshGlowMaterial());
        sceneManager.scene.add(atmosphere);
    },
    update: function(currentTime) {
        geoCoordTranslator.update(currentTime);
        sceneManager.scene.children.forEach(function(value) {
            if (value.hasOwnProperty("geoPosition"))
                value.position.copy(geoCoordTranslator.g2c(value.geoPosition()));
        });
    },
    addSatellite: function(name, keplerParams) {
        var sat = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshBasicMaterial({color: colorPicker.getActualColor()}));
        sceneManager.scene.add(sat);
        var label = sceneManager.makeTextSprite(name);
        sceneManager.scene.add(label);
        sat.geoPosition = label.geoPosition = function() {
            return satelliteTracker.getSatellitePosition(keplerParams, 0);
        };
        for (var i = 1; i < 60; i++) {
            var orb = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial({color: colorPicker.getActualColor()}));
            sceneManager.scene.add(orb);
            orb.geoPosition = (function(timeOffset) {
               var t = timeOffset;
               return function() {
                  return satelliteTracker.getSatellitePosition(keplerParams, t);
               };
            })(-i / (60 * keplerParams.meanMotion));
        }
        colorPicker.changeActualColor();
    }
};



//=== 3D MODEL ==================================================================================================================

var model = {
    renderer: new THREE.WebGLRenderer({preserveDrawingBuffer: true}),
    initialTime: new Date(),
    currentTime: new Date(),
    timeFactor: 1,
    handlers: {
        mX: 0,
        mY: 0,
        mDown: 0,
        mMove: 0,
        handlerMouseDown : function(e) {
            var event = e || window.event;
            model.mX = event.clientX;
            model.mY = event.clientY;
            model.mDown = 1;
        },
        handlerMouseMove: function (e) {
            if (!model.mDown)
                return;
            var event = e || window.event;
            sphericalCamera.azimuth += (event.clientX - model.mX) * 0.3;
            sphericalCamera.zenith -= (event.clientY - model.mY) * 0.3;
            model.mX = event.clientX;
            model.mY = event.clientY;
            model.mMove = 1;
        },
        handlerMouseUp: function(e) {
            model.mDown = model.mMove = 0;
        },
        handlerMouseWheel: function(e) {
            var event = e || window.event;
            sphericalCamera.distance += 20 * (event.wheelDelta ? event.wheelDelta / 120 : -event.deltaY / 3);
            event.preventDefault();
        },
        registerHandlers: function(domElement) {
            domElement.onmousedown = model.handlers.handlerMouseDown;
            domElement.onmousemove = model.handlers.handlerMouseMove;
            domElement.onmousewheel = model.handlers.handlerMouseWheel;
            domElement.onwheel = model.handlers.handlerMouseWheel;
            domElement.onmouseup = model.handlers.handlerMouseUp;
            domElement.onmouseout = model.handlers.handlerMouseUp;
            domElement.onselectstart = function() { return false; };
        }
    },
    tleParser: {
        checkTle: function(row) {
            if (row.length != 69)
                return 0;
            var checksum = 0;
            for (var i = 0; i < 68; i++) {
                if (row.charAt(i) == '-')
                    checksum++;
                if (row.charAt(i) >= '0' && row.charAt(i) <= '9')
                    checksum += row.charAt(i) - '0';
            }
            return checksum % 10 == row.charAt(68) - '0';
        },
        getSemimajorAxis: function(meanMotion) {
            var GM = 398600441800000;
            return Math.pow(Math.sqrt(GM) / (2 * Math.PI * meanMotion), 2 / 3);
        },
        getEpoch: function(epochYear, epochFraq) {
            epochYear += (epochYear >= 57 ? 1900 : 2000);
            return new Date(Date.UTC(epochYear, 0, 1) + (epochFraq - 1) * 86400000);
        },
        getKeplerParams: function(tle) {
            if (!model.tleParser.checkTle(tle[1]) || !model.tleParser.checkTle(tle[2]))
                return;
            var p = {};
            p.eccentricity      = parseFloat("0." + tle[2].substr(26, 7));
            p.inclination       = parseFloat(tle[2].substr(8, 8)) * Math.PI / 180;
            p.argPeriapsis      = parseFloat(tle[2].substr(34, 8)) * Math.PI / 180;
            p.longitudeAscNode  = parseFloat(tle[2].substr(17, 8)) * Math.PI / 180;
            p.meanAnomaly       = parseFloat(tle[2].substr(43, 8)) * Math.PI / 180;
            p.meanMotion        = parseFloat(tle[2].substr(52, 11)) / (24 * 60 * 60);
            p.semimajorAxis     = model.tleParser.getSemimajorAxis(p.meanMotion);
            p.epoch             = model.tleParser.getEpoch(parseInt(tle[1].substr(18, 2)), parseFloat(tle[1].substr(20, 12)));
            return p;
        }
    },
//-------------------------------------------------------------------------------------------------------------------------------
    init: function(width, height, timeFactor, domContainer) {
        model.renderer.setSize(width, height);
        domContainer.appendChild(model.renderer.domElement);
        model.timeFactor = timeFactor;
        model.handlers.registerHandlers(domContainer);
        sphericalCamera.init(width / height);
        sceneManager.init();
        model.update();
    },
    update: function() {
        requestAnimationFrame(model.update);
        model.currentTime = new Date(model.initialTime.getTime() + (new Date().getTime() - model.initialTime.getTime()) * model.timeFactor);
        sceneManager.update(model.currentTime);
        sphericalCamera.update();
        model.renderer.render(sceneManager.scene, sphericalCamera.camera);
    },
    addSatellite: function(tle) {
        var keplerParams = model.tleParser.getKeplerParams(tle);
        if (!keplerParams) {
            alert("Incorrect TLE");
            return;
        }
        sceneManager.addSatellite(tle[0], keplerParams);
    }
};



//=== MATERIALS =================================================================================================================

function MeshDayNightMaterial() {
    var uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib['phong'].uniforms);
    uniforms.map            = {type: "t", value: THREE.ImageUtils.loadTexture('img/earth_tex_4k.jpg')};
    uniforms.nightMap       = {type: "t", value: THREE.ImageUtils.loadTexture('img/earth_night_4k.jpg')};
    uniforms.bumpMap        = {type: "t", value: THREE.ImageUtils.loadTexture('img/earth_bump_4k.jpg')};
    uniforms.specularMap    = {type: "t", value: THREE.ImageUtils.loadTexture('img/earth_specular_4k.jpg')};
    var material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: THREE.ShaderLib['phong'].vertexShader,
        fragmentShader: [
            "uniform vec3 diffuse;",
            "uniform float opacity;",
            "uniform vec3 ambient;",
            "uniform vec3 emissive;",
            "uniform vec3 specular;",
            "uniform float shininess;",
            THREE.ShaderChunk["color_pars_fragment"],
            THREE.ShaderChunk["map_pars_fragment"],
            "uniform sampler2D nightMap;",
            THREE.ShaderChunk["lightmap_pars_fragment"],
            THREE.ShaderChunk["envmap_pars_fragment"],
            THREE.ShaderChunk["fog_pars_fragment"],
            THREE.ShaderChunk["lights_phong_pars_fragment"],
            THREE.ShaderChunk["shadowmap_pars_fragment"],
            THREE.ShaderChunk["bumpmap_pars_fragment"],
            THREE.ShaderChunk["normalmap_pars_fragment"],
            THREE.ShaderChunk["specularmap_pars_fragment"],
            "void main() {",
                "gl_FragColor = vec4(vec3(1.0), opacity);",
                "vec3 dayColor = texture2D(map, vUv).rgb;",
                "vec3 nightColor = texture2D(nightMap, vUv).rgb;",
                "vec4 lDirection = viewMatrix * vec4(directionalLightDirection[0], 0.0);",
                "float cosineAngleSunToNormal = dot(normalize(vNormal), normalize(lDirection.xyz));",
                "cosineAngleSunToNormal = clamp(cosineAngleSunToNormal * 8.0, -1.0, 1.0);",
                "float mixAmount = cosineAngleSunToNormal * 0.5 + 0.5;",
                "vec3 resColor = mix(nightColor, dayColor, mixAmount);",
                "vec4 texelColor = vec4(resColor, 1.0);",
                "#ifdef GAMMA_INPUT",
                    "texelColor.xyz *= texelColor.xyz;",
                "#endif",
                "gl_FragColor = gl_FragColor * texelColor;",
                THREE.ShaderChunk["alphatest_fragment"],
                THREE.ShaderChunk["specularmap_fragment"],
                THREE.ShaderChunk["lights_phong_fragment"],
                THREE.ShaderChunk["lightmap_fragment"],
                THREE.ShaderChunk["color_fragment"],
                THREE.ShaderChunk["envmap_fragment"],
                THREE.ShaderChunk["shadowmap_fragment"],
                THREE.ShaderChunk["linear_to_gamma_fragment"],
                THREE.ShaderChunk["fog_fragment"],
            "}"
        ].join("\n"),
        lights: true
    });
    material.map = material.bumpMap = material.specularMap = true;
    return material;
}

function MeshGlowMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            coeficient: {type: "f", value: 0.75},
            power: {type: "f", value: 4.5},
            glowColor: {type: "c", value: new THREE.Color(0x99ccff)},
        },
        vertexShader: [
            "varying vec3 vVertexWorldPosition;",
            "varying vec3 vVertexNormal;",
            "void main() {",
                "vVertexNormal = normalize(normalMatrix * normal);",
                "vVertexWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;",
                "gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
            "}",
        ].join('\n'),
        fragmentShader: [
            "uniform vec3 glowColor;",
            "uniform float coeficient;",
            "uniform float power;",
            "varying vec3 vVertexNormal;",
            "varying vec3 vVertexWorldPosition;",
            "void main() {",
                "vec3 worldCameraToVertex = vVertexWorldPosition - cameraPosition;",
                "vec3 viewCameraToVertex = (viewMatrix * vec4(worldCameraToVertex, 0.0)).xyz;",
                "viewCameraToVertex = normalize(viewCameraToVertex);",
                "float intensity = pow(coeficient + dot(vVertexNormal, viewCameraToVertex), power);",
                "gl_FragColor = vec4(glowColor, intensity);",
            "}",
        ].join('\n'),
        transparent: true,
        depthWrite: false
    });
}

