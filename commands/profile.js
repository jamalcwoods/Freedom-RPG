const { SlashCommandBuilder} = require('@discordjs/builders');
const { User, MessageActionRow, MessageButton } = require('discord.js');
const { drawCard } = require('../profileCardCreator')
const { clone } = require("../tools.js")


module.exports = {
        data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('View your profile'),
        config:{
                getPlayerData:true
        },
                async execute(interaction,componentConfig,callback){
                let playerData = componentConfig.playerData
                drawCard(playerData,interaction.user.avatarURL({format:"png"}),function(path){
                        const row1 = new MessageActionRow()
                        .addComponents(
                                new MessageButton()
                                .setCustomId('showIconKey_NULL')
                                .setLabel('Show Icon Key')
                                .setStyle('PRIMARY'),

                                new MessageButton()
                                .setCustomId('showTermKey_NULL')
                                .setLabel('Show Term Key')
                                .setStyle('PRIMARY')
                        );
                        if(playerData.tutorial == 0){
                                playerData.tutorial++

                                let tutorialText = "```diff\n"
                                tutorialText += "The image below is a preview of your character's stats. You can do the /profile command to view this as long as you are not in another session"
                                tutorialText += "\n\nTo get more acquainted with this game's combat we recommend you use /town and visit the training hall to learn the basics of combat"
                                tutorialText += "```"

                                interaction.reply({
                                        files: [path],
                                        content: tutorialText,
                                        components: [row1],
                                        embeds: []
                                })

                                let updates = [
                                        {
                                                id:playerData.id,
                                                path:"tutorial",
                                                value:1
                                        }
                                ]

                                callback({
                                        updatePlayer:updates,
                                })               
                        } else {
                                interaction.reply({
                                        files: [path],
                                        content: " ",
                                        components: [row1],
                                        embeds: []
                                })
                                callback({})
                        }
                })
        }
};