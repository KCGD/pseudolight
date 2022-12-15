# Pseudolight

pseudolight is a program that provides automatic screen brightening / darkening to GNU/Linux systems which do not have hardware support for ambient light sensing. It utilizes the webcam to sense the overall brightness of the current environment, and adjusts the screen brightness accordingly. 

# Installing
## From source
### Getting the code
Once these have finished, clone and cd into the repository with this command:
```bash
git clone https://github.com/KCGD/pseudolight.git
cd pseudolight
```
### Installing dependencies

To build this program, make sure you have `nodejs`,  `npm`, `brightnessctl` and any text editor installed (eg: vim or nano)

#### Arch
```bash
sudo pacman -S --needed nodejs npm brightnessctl nano
```
#### Debian / Debian based
```bash
sudo apt install nodejs npm brightnessctl nano
```

#### Fedora and Red Hat 
```bash
sudo dnf install nodejs brightnessctl nano
```
### Installing dependencies (the sequel)
After these have completed (and you are in the repository root folder), install the project dependencies with npm:
```bash
npm i
```

### Building / Installing
After you have installed the dependencies, build the code with:
```bash
make build
```
And install it with:
```bash
sudo make install
```

## From your package manager (coming soon)!
To install pseudolight through your package manager, run this:

#### Arch (using an AUR helper, i'll use yay in this example)
```bash
yay -S pseudolight
```


# Setting up pseudolight
Once pseudolight has installed (you can check by running `pseudolight --help`), you can set it up as a system daemon by running this command (currently only systemd is supported, but that is planned to change):

```bash
sudo pseudolight --install-daemon
```
### Configuration
To configure pseudolight, run:
```bash
sudo pseudolight --edit-config
```
Followed by:
```bash
sudo systemctl restart pseudolight-systemd.service
```
in order to apply the settings.

# Contribution
Contributions are always welcome! Please follow the general structure of the project when contributing in order to preserve code readability and maintainability. I aim to keep this project as minimal as possible.

# Work-In-Progress features
These are features which are not currently implemented, but are planned to be added soon.
* Webcam selection via configuration file
  * Webcam autodetection
* Support for more init systems
  * sv/openrc
  * upstart
* Consideration for brightness of on-screen content (may not work under wayland)

# Licensing
This project is open source, under the GNU Public License v2.