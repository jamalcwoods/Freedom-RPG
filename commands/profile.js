const { SlashCommandBuilder } = require('@discordjs/builders');
const { User } = require('discord.js');
const { drawCard } = require('../profileCardCreator')
const { clone } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('View your profile'),
    config:{
        getPlayerData:true
    },
        async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        drawCard(playerData,interaction.user.avatarURL({format:"png"}),function(path){
                interaction.reply({
                        files: [path],
                        content: " ",
                        components: [],
                        embeds: []
                })
                callback({})
        })
        }
};