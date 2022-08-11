const { MessageEmbed } = require('discord.js');
const { populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"cancel"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        interaction.update(populateCloseInteractionMessage("Interaction Canceled"))
        
        callback({
            removeSession:session
        })
    }
}