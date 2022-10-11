const { populateCloseInteractionMessage} = require("../sessionTools.js")
const { getTownDBData } = require("../firebaseTools.js")

module.exports = {
    config:{
        getPlayerData:true
    },
    data:{
        name:"endExpedition"
    },
    async execute(interaction,componentConfig,callback){
        let player = componentConfig.playerData
        let val = componentConfig.args[0]

        let townID = player.expedition
        delete player.expedition

        let updates = [
            {
                id:player.id,
                path:"",
                value:player
            }
        ]

        getTownDBData(townID,function(town){
            for(var i = 0; i < town.expeditions.length;i++){
                if(town.expeditions[i].playerID == player.id){
                    for(resource in town.expeditions[i].townResources){
                        town.resources[resource][0] += town.expeditions[i].townResources[resource]
                    }
                    town.expeditions.splice(i,1)
                }
            }

            let townUpdates = [
                {
                    id:town.id,
                    path:"",
                    value:town
                }
            ]

            let response;
            if(val == "0"){
                response = "Your expedition will continue"
            } else {
                response = "Expedition Ended. Resources earned have been delivered to the town you left from"
            }

            interaction.update(populateCloseInteractionMessage(response))
            
            callback({
                updateTown:townUpdates,
                updatePlayer:updates
            })
        })

        

        
    }
}