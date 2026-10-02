const fs = require('fs');

function checkGLBAnimations(filePath) {
  const buffer = fs.readFileSync(filePath);
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546C67) {
    console.log(filePath, 'Not a GLB');
    return;
  }
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);
  
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.readUInt32LE(16);
  if (chunkType !== 0x4E4F534A) {
    console.log(filePath, 'First chunk is not JSON');
    return;
  }
  
  const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
  const json = JSON.parse(jsonString);
  
  const animations = json.animations ? json.animations.map(a => a.name) : [];
  console.log(filePath, 'Animations:', animations);
}

checkGLBAnimations('public/game/female player/girl-player.glb');
checkGLBAnimations('public/game/male player/male-player.glb');
checkGLBAnimations('public/game/obstacle/cylinder_obstacle.glb');
checkGLBAnimations('public/game/obstacle/down_obstacle.glb');
checkGLBAnimations('public/game/obstacle/spoetted_cylinder_obstacle.glb');
checkGLBAnimations('public/game/obstacle/up_obstacle.glb');
