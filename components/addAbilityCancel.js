const { MessageEmbed } = require('discord.js');
const { populateAbilityCreatorButtons, populateAbilityCreatorWindow} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"addAbilityCancel"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        delete session.session_data.temp 

        interaction.update({
            content: " ",
            components: populateAbilityCreatorButtons(session),
            embeds: populateAbilityCreatorWindow(session)
        })

        callback({
            updateSession:session,
        })
    }
}