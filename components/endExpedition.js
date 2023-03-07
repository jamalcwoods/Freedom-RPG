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
            let titleMap = {
                "exp":"Experience",
                "abilityPoints":"Ability Points",
                "gold":"Gold",
                "wood":"Wood",
                "food":"Food",
                "minerals":"Minerals"
            }   

            let resourcesEarned = "Expedition Results:\n\n"
            for(var i = 0; i < town.expeditions.length;i++){
                if(town.expeditions[i].playerID == player.id){
                    if(!town.contributors){
                        town.contributors = {}
                    }
                    for(resource in town.expeditions[i].townResources){
                        resourcesEarned += titleMap[resource] +  ": " + town.expeditions[i].townResources[resource] + "\n"
                        let amount = 0;
                        if(town.resources[resource][0] + town.expeditions[i].townResources[resource] > town.resources[resource][1]){
                            amount = (town.resources[resource][1] - town.resources[resource][0])
                            town.resources[resource][0] = town.resources[resource][1]
                            
                        } else {
                            amount = town.expeditions[i].townResources[resource]
                            town.resources[resource][0] += amount
                        }
                        if(amount != 0){
                            if(!town.contributors[player.id]){
                                town.contributors[player.id] = amount
                            } else {
                                town.contributors[player.id] += amount
                            }
                        }
                        if(amount > 0){
                            resourcesEarned += response + ": " + amount + "\n"
                        }
                    }
                    if(town.expeditions[i].resources){
                        for(resource in town.expeditions[i].resources){
                            resourcesEarned += titleMap[resource] +  ": " + town.expeditions[i].resources[resource] + "\n"
                        }
                    }
                    if(town.expeditions[i].rewardMessages){
                        for(message of town.expeditions[i].rewardMessages){
                            resourcesEarned += message + "\n"
                        }
                    }
                    town.expeditions.splice(i,1)
                    break;
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
                callback({})
            } else {
                response = resourcesEarned
                callback({
                    updateTown:townUpdates,
                    updatePlayer:updates
                })
            }

            interaction.update(populateCloseInteractionMessage(response))
        })

        

        
    }
}