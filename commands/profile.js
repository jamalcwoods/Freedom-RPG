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
                let bot = componentConfig.choices[0].member.user.bot
                let page = componentConfig.choices[1].value
                let pngURL = "https://cdn.discordapp.com/avatars/" + id + "/" + avatarID + ".png"
                if(avatarID == null){
                        pngURL = "https://cdn.discordapp.com/embed/avatars/index.png"
                }
                const row1 = new MessageActionRow()
                if(!bot){
                        getPlayerDBData({id:id},function(playerData){
                                if(playerData){
                                        drawCard(playerData,pngURL,page,function(path){
                                                switch(page){
                                                        case "stats":
                                                                row1.addComponents(
                                                                        new MessageButton()
                                                                        .setCustomId('showIconKey_NULL')
                                                                        .setLabel('Show Icon Key')
                                                                        .setStyle('PRIMARY'),
                                        
                                                                        new MessageButton()
                                                                        .setCustomId('showTermKey_NULL')
                                                                        .setLabel('Show Term Key')
                                                                        .setStyle('PRIMARY'),

                                                                        new MessageButton()
                                                                        .setCustomId('deleteMessage')
                                                                        .setLabel('Dismiss')
                                                                        .setStyle('DANGER')
                                                                );
                                                                if(playerData.tutorial < 1){
                                                                        interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });             
                                                                } else if(playerData.tutorial == 1){
                                                                        let tutorialText = "Though you are now familiar with how to fight, you need to increase your stats using your skill points.\n\nThese are normally obtained as you level up, but you have been given some to get you started. Do the `/stats` command to start using them"
                                        
                                                                        interaction.reply({
                                                                                files: [path],
                                                                                content: tutorialText,
                                                                                embeds: []
                                                                        })
                                        
                                                                        let updates = [
                                                                                {
                                                                                        id:playerData.id,
                                                                                        path:"tutorial",
                                                                                        value:2
                                                                                }
                                                                        ]
                                        
                                                                        callback({
                                                                                updatePlayer:updates,
                                                                        })
                                                                } else {

                                                                        if(componentConfig.forceUpdateInteraction){
                                                                                interaction.update({
                                                                                        files: [path],
                                                                                        content: " ",
                                                                                        components: [row1],
                                                                                        embeds: []
                                                                                }) 
                                                                        } else {
                                                                                interaction.reply({
                                                                                        files: [path],
                                                                                        content: " ",
                                                                                        components: [row1],
                                                                                        embeds: []
                                                                                })          
                                                                        }
                                                                        callback({})
                                                                }
                                                                break;
                                                        
                                                        case "achievements":
                                                                row1.addComponents(
                                                                        new MessageButton()
                                                                        .setCustomId('deleteMessage')
                                                                        .setLabel('Dismiss')
                                                                        .setStyle('DANGER')
                                                                );
                                                                if(playerData.tutorial != 'completed'){
                                                                        interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });             
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
                                                }
                                        })  
                                } else {
                                        interaction.reply({ content: "This user does not have an account, they must do the `/start` command to create one", ephemeral: true });   
                                }
                        })
                } else {
                        interaction.reply({ content: 'This command can only be used on discord user accounts', ephemeral: true });
                }
        }
};