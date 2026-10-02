const fs = require('fs');

function checkGLBSkeleton(filePath) {
  const buffer = fs.readFileSync(filePath);
  const chunkLength = buffer.readUInt32LE(12);
  const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
  const json = JSON.parse(jsonString);
  
  console.log(filePath, 'Skins:', json.skins ? json.skins.length : 0, 'Nodes with joints:', json.nodes ? json.nodes.filter(n => n.skin !== undefined).length : 0);
}

checkGLBSkeleton('public/game/female player/girl-player.glb');
checkGLBSkeleton('public/game/male player/male-player.glb');
