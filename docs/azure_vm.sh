#!/bin/bash

AZURE_RESOURCE_GROUP='vm1_group'

usage() {
echo "
Usage $0 [options]

Options:
    start     start vm's in resource group
    stop      stop vm's in resource group
    restart   restart vm's in resource group
    status    status vm's in resource group
    ip        list of ip's
" 1>&2; exit 1;
}

invalid_input() {
    echo "$1"
    usage
}

while (( "$#" )); 
do
    case $1 in
        start) start=$1; shift;;
        stop) stop=$1; shift;;
        restart) restart=$1; shift;;
        status) status=$1; shift;;
        ip) ip=$1; shift;;
        help) usage;;
        *) invalid_input "Unknown parameter : $1";;
    esac
done


AZURE_RESOURCE_GROUP='vm1_group'

if [[ $start ]];
then
    VM_NAMES=$(az vm list -g $AZURE_RESOURCE_GROUP --show-details --query "[?powerState=='VM deallocated'].{ name: name }" -o tsv)
    for NAME in $VM_NAMES
    do
    	NAME=`echo $NAME | sed 's/ *$//g'`
        echo "Starting $NAME"
        az vm start -n $NAME -g $AZURE_RESOURCE_GROUP --no-wait
    done
fi

if [[ $stop ]];
then
    VM_NAMES=$(az vm list -g $AZURE_RESOURCE_GROUP --show-details --query "[?powerState=='VM running'].{ name: name }" -o tsv)
    for NAME in $VM_NAMES
    do
    	NAME=`echo $NAME | sed 's/ *$//g'`
        echo "Stopping $NAME"
        az vm deallocate -n $NAME -g $AZURE_RESOURCE_GROUP --no-wait
    done
fi

if [[ $restart ]];
then
    VM_NAMES=$(az vm list -g $AZURE_RESOURCE_GROUP --show-details --query "[?powerState=='VM running'].{ name: name }" -o tsv)
    echo "Restarting all running VMs"
    for NAME in $VM_NAMES
    do
    	NAME=`echo $NAME | sed 's/ *$//g'`
        echo "Stopping $NAME"
        az vm deallocate -n $NAME -g $AZURE_RESOURCE_GROUP
        echo "Starting $NAME"
        az vm start -n $NAME -g $AZURE_RESOURCE_GROUP
    done
fi

if [[ $status ]];
then
    echo "Power Status of all VMs"
    echo "-----------------------"
    az vm list -g $AZURE_RESOURCE_GROUP --show-details --query "[].{name: name, status: powerState}" -o table
fi


if [[ $ip ]];
then
    az vm list -g $AZURE_RESOURCE_GROUP --show-details --query "[?powerState=='VM running'].{ name:name, ip: publicIps }" -o table
fi
