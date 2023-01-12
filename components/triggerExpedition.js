const { populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"triggerExpedition"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let val = componentConfig.args[0]

        let response;
        if(val == "0"){
            response = "Your expedition has begun! Do a command to end it at any time"

            session.session_data.player.expedition = session.session_data.town.id;
            if(!session.session_data.town.expeditions){
                session.session_data.town.expeditions = []
            }
    
            let now = new Date();
    
            session.session_data.town.expeditions.push({
                playerID: session.session_data.player.id,
                startTime: now.getTime(),
                status: {
                    checkIns: [-1,-1,-1],
                    lastCheckIn: -1,
                    type: 0
                },
                townResources:{
                    wood:0,
                    food:0,
                    minerals:0
                }
            })
    
            let townUpdates = [
                {
                    id:session.session_data.town.id,
                    path:"",
                    value:session.session_data.town
                }
            ]
    
            let updates = [
                {
                    id:session.user_ids[0],
                    path:"",
                    value:session.session_data.player
                }
            ]

            interaction.update(populateCloseInteractionMessage(response,true))
        
            callback({
                updateTown:townUpdates, 
                removeSession:session,
                updatePlayer:updates
            })

        } else {
            response = "Expedition cancelled"
            interaction.update(populateCloseInteractionMessage(response,true))

            callback({
                removeSession:session
            })
        }
    }
}