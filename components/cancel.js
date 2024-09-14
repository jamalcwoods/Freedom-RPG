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
        console.log()
        if(componentConfig.args && componentConfig.args[0] == '1'){
            interaction.update(populateCloseInteractionMessage("Interaction Canceled",true))
        } else {
            interaction.update(populateCloseInteractionMessage("Interaction Canceled"))
        }
        
        
        callback({
            removeSession:session
        })
    }
}