
const { populateTownVisitWindow, populateTownVisitControls, populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"tavernOrder"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        
        if(session.type == "townVisit"){
            if(interaction.values[0].split("_")[0] == "lives"){
                if(session.session_data.player.gold >= parseInt(interaction.values[0].split("_")[1]) * 1000){
                    session.session_data.player.lives += parseInt(interaction.values[0].split("_")[1])

                    session.session_data.player.gold -= parseInt(interaction.values[0].split("_")[1]) * 1000
                } else {
                    interaction.reply({ content: "You can not afford this purchase!", ephemeral: true });
                }
            } else if(session.session_data.player.gold >= parseInt(interaction.values[0].split("_")[2])){
                let now = new Date();
                if(!session.session_data.player.boosters){
                    session.session_data.player.boosters = []
                }

                let overwrite = false;
                for(boost of session.session_data.player.boosters){
                    if(boost.type == interaction.values[0].split("_")[0]){
                        overwrite = true;
                        boost.expire = now.getTime() + (3600000 * parseFloat(interaction.values[0].split("_")[3]))
                        boost.value = parseInt(interaction.values[0].split("_")[1])
                    }
                }

                if(!overwrite){
                    session.session_data.player.boosters.push({
                        expire:now.getTime() + (3600000 * parseFloat(interaction.values[0].split("_")[3])),
                        type:interaction.values[0].split("_")[0],
                        value:parseInt(interaction.values[0].split("_")[1])
                    })
                }
                
                session.session_data.player.gold -= parseInt(interaction.values[0].split("_")[2])
            } else {
                interaction.reply({ content: "You can not afford this purchase!", ephemeral: true });
            }

            interaction.update({
                content: " ",
                embeds: populateTownVisitWindow(session),
                components: populateTownVisitControls(session),
                ephemeral:true
            })

            let updates = []

            updates.push({
                id:session.session_data.player.id,
                path:"",
                value:session.session_data.player
            })

            callback({
                updatePlayer:updates,
                updateSession:session
            })
        }
    }
}