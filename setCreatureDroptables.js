const fs = require('fs');
let inData = require('./data.json')

for(creature of inData.creatures){
  creature.droptable = [
    {
      chance:38,
      obj:{
        type:"resource",
        resource:"gold",
        resourceName: "gold",
        amount: 5
      }
    },
    {
      chance:18,
      obj:{
        type:"resource",
        resource:"gold",
        resourceName: "gold",
        amount: 10
      }
    },
    {
      chance:8,
      obj:{
        type:"resource",
        resource:"gold",
        resourceName: "gold",
        amount: 15
      }
    },
    {
      chance:20,
      obj:{
        nothing:true
      }
    },
    {
      chance:8,
      obj:{
        ref:{
            type:"rngEquipment",
            rngEquipment:{
            scaling:true,
            value:1,
            conStats:1,
            conValue:0.2,
            lockStatTypes: true,
            types:["weapon"]
            }
        }
      }
    },
    {
      chance:8,
      obj:{
        ref:{
            type:"rngEquipment",
            rngEquipment:{
            scaling:true,
            value:1,
            conStats:1,
            conValue:0.2,
            lockStatTypes: true,
            types:["gear"]
            }
        }
      }
    }
  ]
}




let data = JSON.stringify(inData,null,2);
fs.writeFileSync('data.json', data);