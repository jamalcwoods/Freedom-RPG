const { SlashCommandBuilder} = require('@discordjs/builders');
const { User, MessageActionRow, MessageButton } = require('discord.js');
const { drawCard } = require('../profileCardCreator')
const { clone } = require("../tools.js")
const { getPlayerDBData } = require("../firebaseTools.js")





module.exports = {
        data: new SlashCommandBuilder()
                .setName('profile')
                .setDescription('View your profile')
                .addUserOption(option =>
                        option.setName("player")
                        .setDescription("Player whose profile you would like to view")
                        .setRequired(true)
                )
                .addStringOption(option => 
                        option.setName('page')
                        .setDescription('Profile aspect to view')
                        .setRequired(true)
                        .addChoice('Achievements', 'achievements')
                        .addChoice('Stats', 'stats')
                ),
        config:{}
        ,
        async execute(interaction,componentConfig,callback){
                let id = componentConfig.choices[0].value
                let avatarID = componentConfig.choices[0].member.user.avatar
                let page = componentConfig.choices[1].value
                let pngURL = "https://cdn.discordapp.com/avatars/" + id + "/" + avatarID + ".png"
                if(avatarID == null){
                        pngURL = "https://cdn.discordapp.com/embed/avatars/index.png"
                }
                getPlayerDBData({id:id},function(playerData){
                        if(playerData){
                                drawCard(playerData,pngURL,page,function(path){
                                        switch(page){
                                                case "stats":
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
                                                        break;
                                                
                                                case "achievements":
                                                        if(playerData.tutorial == 0){
                                                                playerData.tutorial++
                                
                                                                let tutorialText = "```diff\n"
                                                                tutorialText += "The image below is a preview of your character's stats. You can do the /profile command to view this as long as you are not in another session"
                                                                tutorialText += "\n\nTo get more acquainted with this game's combat we recommend you use /town and visit the training hall to learn the basics of combat"
                                                                tutorialText += "```"
                                
                                                                interaction.reply({
                                                                        files: [path],
                                                                        content: tutorialText,
                                                                        components: [],
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
                                                                        components: [],
                                                                        embeds: []
                                                                })
                                                                callback({})
                                                        }
                                                        break;
                                        }
                                })  
                        } else {
                                interaction.reply({ content: "This user does not have an account", ephemeral: true });   
                        }
                })
        }
};