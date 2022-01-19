
# pi hardware
USER=pi
HOST=raspberrypi.local
PORT=22
INSTALL_DIR="/home/pi/FlamingMonkeyHeadMusicPlayer"
EXE="flamingmonkeyheadmusicplayer"
APPNAME="Flaming Monkey Head"

# qemu
#USER=pi
#HOST=localhost
#PORT=2222

args=()
VERBOSE=false

################################
# scan command line args:
function usage
{
  echo "$0 setup rpi $HOST"
  echo "Usage: "
  echo "  $0               (default)"
  echo "  $0 --help        (this help)"
  echo "  $0 --verbose     (output verbose information)"
  echo ""
}
usage
ARGC=$#
ARGV=("$@")
non_flag_args=0
non_flag_args_required=0
for ((i = 0; i < ARGC; i++)); do
  if [[ $ARGC -ge 1 && ${ARGV[$i]} == "--help" ]]; then
    usage
    exit -1
  fi
  if [[ $ARGC -ge 1 && ${ARGV[$i]} == "--verbose" ]]; then
    VERBOSE=true
    continue
  fi
  if [[ $ARGC -ge 1 && ${ARGV[$i]:0:2} == "--" ]]; then
    echo "Unknown option ${ARGV[$i]}"
    exit -1
  fi

  # general non -- args
  args+=("${ARGV[$i]}")
  $VERBOSE && echo "Parsing Args: \"${ARGV[$i]}\""
  ((non_flag_args+=1))
done

# output help if they're getting it wrong...
if [ $non_flag_args_required -ne 0 ] && [[ $ARGC -eq 0 || ! $ARGC -ge $non_flag_args_required ]]; then
  [ $ARGC -gt 0 ] && echo "Expected $non_flag_args_required args, but only got $ARGC"
  usage
  exit -1
fi
################################

echo ""
echo "We assume you have already:
- created a Raspian drive (e.g. MicroSD or USB) with setup_image_buster.sh
- setup internet sharing in SystemPreferences/Sharing/InternetSharing
- connected the drive into the Rpi
- connected the Rpi to your mac with network cable and booted it up,
  allowing time for partition to resize (dont disconnect power during this!)
"
echo ""
read -p "Press enter to continue"

apt_get="sudo DEBIAN_FRONTEND=noninteractive apt-get -yq --allow-unauthenticated --allow-downgrades --allow-change-held-packages --allow-remove-essential "
apt="sudo DEBIAN_FRONTEND=noninteractive apt -yq --allow-unauthenticated --allow-downgrades --allow-change-held-packages --allow-remove-essential "

source "../vstdev/MantisSynth/rpi/common.sh"

#if [ `isInApt "node"` == 0 ]; then
#fi

#echo ""
#echo "Removing anything installed before"
#remoteCmd "$apt remove node npm libasound2 libasound2-dev"

#echo ""
#echo "Update/Upgrading your Raspberry Pi..."
#echo " - package lists could be outdated/wrong"
#remoteCmd "$apt_get update"
#remoteCmd "$apt_get upgrade"

echo ""
echo "Update the time"
echo "  - in case the rPI's time service is disabled, or not writing because of read-only mode..."
echo "  - we pull the current time off the header returned by fetching http://google.com"
echo "  - use that to set the system time"
remoteCmd "sudo date -s \"\$(wget -qSO- --max-redirect=0 google.com 2>&1 | grep Date: | cut -d' ' -f5-8)Z\""

echo ""
echo "Installing..."
remoteCmd "$apt_get install node"
remoteCmd "$apt_get install npm"
remoteCmd "$apt_get install libasound2"
remoteCmd "$apt_get install libasound2-dev"

echo ""
echo "electron's ruby/fpm sucks on raspberry pi:"
echo "  why?  it gives the error:   'ruby: cannot execute binary file: Exec format error'"
echo "so, install our own ruby and fpm"
echo "requires:"
echo "   export USE_SYSTEM_FPM=\"true\""
echo "before the electron-builder command"
remoteCmd "$apt_get install ruby-full; sudo gem uninstall --all --force --executables fpm; sudo gem install fpm -v 1.10.2"

echo ""
echo "Installing... node version manager (we pick a past version, because the rpi time can be some days in the past)"
remoteCmd "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash"
remoteCmd "source ~/.nvm/nvm.sh; nvm install 14.18.0; nvm use 14.18.0; nvm alias default node"
if [ "$?" != 0 ]; then
  echo "something with the nvm install failed"
  exit -1
fi

echo ""
echo "Removing previous app"
remoteCmd "rm -rf '$INSTALL_DIR'"

echo ""
echo "Installing app"
npm run deploy-rpi

echo ""
echo "Building app"
echo '- INSTALLING node_modules'
remoteCmd "cd '$INSTALL_DIR'; export DEBUG=electron-builder; npm install"

echo '- BUILDING the APP and APP PACKAGE'
remoteCmd "cd '$INSTALL_DIR'; export DEBUG=electron-builder; npm run electron:buildrpi"

echo ""
echo "Setup the app Icon"
./setup_app_icon.sh

echo ""
echo "Listing Audio Devices:"
remoteCmd "aplay -l"

echo ""
echo "Listing MIDI Devices:"
remoteCmd "amidi -l"


# DISPLAY=:0.0 cd '$INSTALL_DIR/release/linux-armv7l-unpacked' && ./$EXE


#'export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
#[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm'

# DISPLAY=:0 matchbox-keyboard &



#echo "Now, try logging in with:  ssh -p$PORT $USER@$HOST"
#ssh -p$PORT $USER@$HOST

