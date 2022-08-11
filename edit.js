const fs = require('fs');
let inData = require('./data.json')

for(creature of inData.creatures){
  creature.droptable = [
    {
      chance:34,
      obj:{
          ref:{
          type:"staticItemID",
          staticItemID:0
        }
      }
    },
    {
      chance:18,
      obj:{
        ref:{
          type:"staticItemID",
          staticItemID:1
        }
      }
    },
    {
      chance:8,
      obj:{
        ref:{
          type:"staticItemID",
          staticItemID:2
        }
      }
    },
    {
      chance:20,
      obj:{
        nothing:true
      }
    },
    {
      chance:10,
      obj:{
        ref:{
          type:"rngEquipment",
          rngEquipment:{
            scaling:true,
            value:0.5,
            conValue:0.5,
            lockStatTypes:true,
            baseVal:null,
            types:["weapon"]
          }
        }
      }
    },
    {
      chance:10,
      obj:{
        ref:{
          type:"rngEquipment",
          rngEquipment:{
            scaling:true,
            value:0.5,
            conValue:0.5,
            lockStatTypes:true,
            baseVal:null,
            types:["gear"]
          }
        }
      }
    }
  ]
}




let data = JSON.stringify(inData,null,2);
fs.writeFileSync('data.json', data);