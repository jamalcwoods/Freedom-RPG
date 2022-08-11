const {populateInventoryControls, populateInventoryWindow } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"selectInventory"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "inventory"){
            session.session_data.selected = interaction.values[0];
            interaction.update({
                content: " ",
                components: populateInventoryControls(session),
                embeds: populateInventoryWindow(session),
                ephemeral: true,
            })
            
            callback({
                updateSession:session
            })
        }
    }
}