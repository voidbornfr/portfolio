const fs = require('fs');

function printNodes(filePath) {
  const buffer = fs.readFileSync(filePath);
  const chunkLength = buffer.readUInt32LE(12);
  const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
  const json = JSON.parse(jsonString);
  
  const nodes = json.nodes;
  if (!nodes) return;
  
  console.log(`\n--- ${filePath} ---`);
  nodes.forEach((n, i) => {
    console.log(`Node ${i}: ${n.name || 'unnamed'}`);
  });
}

printNodes('public/game/female player/girl-player.glb');
printNodes('public/game/male player/male-player.glb');
