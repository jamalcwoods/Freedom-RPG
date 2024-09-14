const { MessageEmbed } = require('discord.js');
const { populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"removeAccount"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        let updates = [{
            id:session.user_ids[0],
            path:"",
            value:null
        }]

        interaction.update(populateCloseInteractionMessage("Character Removed",true))
        
        callback({
            updatePlayer:updates,
            removeSession:session
        })
    }
}