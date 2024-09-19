const { SlashCommandBuilder} = require('@discordjs/builders');
const { User, MessageActionRow, MessageButton } = require('discord.js');
const { drawCard } = require('../profileCardCreator')
const { clone } = require("../tools.js")
const { getPlayerDBData } = require("../firebaseTools.js")





module.exports = {
        config:{},
        data:{
            name:"profilePopUp"
        },
        async execute(interaction,componentConfig,callback){
                interaction.message.delete()
                let id = componentConfig.args[0]
                let avatarID = componentConfig.args[1]
                let pngURL = "https://cdn.discordapp.com/avatars/" + id + "/" + avatarID + ".png"
                if(avatarID == null){
                        pngURL = "https://cdn.discordapp.com/embed/avatars/index.png"
                }
                getPlayerDBData({id:id},function(playerData){
                        if(playerData){
                                drawCard(playerData,pngURL,"stats",function(path){
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
            
                                            let tutorialText = "\n"
                                            tutorialText += "The image below is a preview of your character's stats. You can do the `/profile stats` command to view this as long as you are not in another session"
                                            tutorialText += "\n\nTo continue with the tutorial, use the `/town` command and visit the training hall to begin learning the basics of combat"
            
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
                        } else {
                                interaction.reply({ content: "This user does not have an account, they must do the `/start` to create one", ephemeral: true });   
                        }
                })
        }
};