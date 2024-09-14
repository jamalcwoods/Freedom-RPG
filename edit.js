const fs = require('fs');
let inData = require('./data.json')

let creatureData = [
  {
    "Region": "Swamp",
    "Name": "Frog"
  },
  {
    "Region": "Tundra",
    "Name": "Wolf"
  },
  {
    "Region": "Desert",
    "Name": "Meerkat"
  },
  {
    "Region": "Islands",
    "Name": "Jellyfish"
  },
  {
    "Region": "Mountains",
    "Name": "Eagle"
  },
  {
    "Region": "Forest",
    "Name": "Rat"
  },
  {
    "Region": "Swamp",
    "Name": "Eel"
  },
  {
    "Region": "Tundra",
    "Name": "Seal"
  },
  {
    "Region": "Desert",
    "Name": "Snake"
  },
  {
    "Region": "Islands",
    "Name": "Squid"
  },
  {
    "Region": "Mountains",
    "Name": "Rabbit"
  },
  {
    "Region": "Forest",
    "Name": "Dragonfly"
  },
  {
    "Region": "Swamp",
    "Name": "Duck"
  },
  {
    "Region": "Tundra",
    "Name": "Penguin"
  },
  {
    "Region": "Desert",
    "Name": "Lizard"
  },
  {
    "Region": "Islands",
    "Name": "Dolphin"
  },
  {
    "Region": "Mountains",
    "Name": "Deer"
  },
  {
    "Region": "Forest",
    "Name": "Squirrel"
  },
  {
    "Region": "Swamp",
    "Name": "Crocodile"
  },
  {
    "Region": "Tundra",
    "Name": "Leopard"
  },
  {
    "Region": "Desert",
    "Name": "Coyote"
  },
  {
    "Region": "Islands",
    "Name": "Crab"
  },
  {
    "Region": "Mountains",
    "Name": "Lion"
  },
  {
    "Region": "Forest",
    "Name": "Horse"
  },
  {
    "Region": "Swamp",
    "Name": "Beetle"
  },
  {
    "Region": "Tundra",
    "Name": "Bear"
  },
  {
    "Region": "Desert",
    "Name": "Scorpion"
  },
  {
    "Region": "Islands",
    "Name": "Parrot"
  },
  {
    "Region": "Mountains",
    "Name": "Goat"
  },
  {
    "Region": "Forest",
    "Name": "Bat"
  },
  {
    "Region": "Swamp",
    "Name": "Turtle"
  },
  {
    "Region": "Tundra",
    "Name": "Ox"
  },
  {
    "Region": "Desert",
    "Name": "Camel"
  },
  {
    "Region": "Islands",
    "Name": "Whale"
  },
  {
    "Region": "Mountains",
    "Name": "Panda"
  },
  {
    "Region": "Forest",
    "Name": "Fox"
  }
 ]

for(creature of inData.creatures){
  for(d of creatureData){
    if(creature.Name == d.Name){
      creature.region = d.Region
    }
  }
}




let data = JSON.stringify(inData,null,2);
fs.writeFileSync('data.json', data);