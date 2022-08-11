// const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { updatePlayerDBData } = require("../firebaseTools")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"createCharacter"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        const embed = new MessageEmbed()
			.setColor('#00ff00')
			.setTitle('Character Created')
			.setDescription('You can now dismiss this message');
        interaction.update({
            content: " ",
            components: [],
            embeds: [embed]
        })
        callback({
            removeSession:session,
            updatePlayer:[{
                id:session.user_ids[0],
                path:"",
                value:session.session_data
            }]
        })
    }
}