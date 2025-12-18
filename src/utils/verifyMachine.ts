import pool from "../db/pool";
const verifyMachine=async (machineId:string,userId:string,machineIp:string)=>{
    const res=await pool.query('SELECT * FROM vps_machines WHERE id=$1 AND "ownerId"=$2',[machineId,userId]);
    if(res.rowCount===0){
        return {
            status:false,
            machine:null
        };
    }
    const machine=res.rows[0];
    if(machine.vps_ip!==machineIp){
        return {
            status:false,
            machine:null
        }
    }
    return {
        status:true,
        machine
    }
}
export default verifyMachine;