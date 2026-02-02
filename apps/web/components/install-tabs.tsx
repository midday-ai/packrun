"use client";

import { useEffect, useRef, useState } from "react";

const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun", "deno", "vlt"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const STORAGE_KEY = "v1.run:pm";

function getStoredPm(): PackageManager {
  if (typeof window === "undefined") return "npm";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && PACKAGE_MANAGERS.includes(stored as PackageManager)) {
    return stored as PackageManager;
  }
  return "npm";
}

interface InstallTabsProps {
  packageName: string;
  hasTypes?: boolean;
}

export function InstallTabs({ packageName, hasTypes }: InstallTabsProps) {
  const [pm, setPm] = useState<PackageManager>("npm");
  const [copied, setCopied] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved preference on mount
  useEffect(() => {
    setPm(getStoredPm());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save preference when changed
  const handlePmChange = (manager: PackageManager) => {
    setPm(manager);
    localStorage.setItem(STORAGE_KEY, manager);
    setIsOpen(false);
  };

  const commands = getCommands(pm, packageName, hasTypes);

  const handleCopy = async (cmd: string) => {
    await navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Header with label and dropdown */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-[#666]">install</span>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium tracking-wide border border-[#444] text-[#888] hover:text-white hover:border-[#666] transition-all"
          >
            {pm}
            <svg
              className={`w-2.5 h-2.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-black border border-[#333] min-w-[100px]">
              {PACKAGE_MANAGERS.map((manager) => (
                <button
                  key={manager}
                  onClick={() => handlePmChange(manager)}
                  className={`block w-full text-left px-3 py-2 text-xs font-medium tracking-wide transition-colors ${
                    pm === manager
                      ? "bg-white text-black"
                      : "text-[#888] hover:text-white hover:bg-[#111]"
                  }`}
                >
                  {manager}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Commands */}
      <div className="space-y-1">
        {commands.map((cmd, i) => (
          <div
            key={i}
            onClick={() => handleCopy(cmd.full)}
            className={`group flex items-center justify-between border border-[#333] px-4 py-3 cursor-pointer transition-colors hover:border-white ${
              cmd.muted ? "bg-black" : "bg-[#111]"
            }`}
          >
            <code className="text-sm">
              <span className="text-[#444] select-none">$ </span>
              <span className={cmd.muted ? "text-[#666]" : "text-[#888]"}>{cmd.command}</span>{" "}
              {cmd.subcommand && (
                <span className={cmd.muted ? "text-[#666]" : "text-[#888]"}>{cmd.subcommand}</span>
              )}{" "}
              {cmd.flags && <span className="text-[#666]">{cmd.flags} </span>}
              <span className="text-white font-bold">{cmd.package}</span>
            </code>
            <span
              className={`text-xs uppercase tracking-wider transition-colors ${
                copied === cmd.full ? "text-white" : "text-[#444] group-hover:text-[#888]"
              }`}
            >
              {copied === cmd.full ? "copied" : "copy"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CommandParts {
  full: string;
  command: string;
  subcommand: string;
  flags?: string;
  package: string;
  muted?: boolean;
}

function getCommands(pm: PackageManager, name: string, hasTypes?: boolean): CommandParts[] {
  const commands: CommandParts[] = [];

  // Main install command
  switch (pm) {
    case "npm":
      commands.push({
        full: `npm install ${name}`,
        command: "npm",
        subcommand: "install",
        package: name,
      });
      break;
    case "pnpm":
      commands.push({
        full: `pnpm add ${name}`,
        command: "pnpm",
        subcommand: "add",
        package: name,
      });
      break;
    case "yarn":
      commands.push({
        full: `yarn add ${name}`,
        command: "yarn",
        subcommand: "add",
        package: name,
      });
      break;
    case "bun":
      commands.push({
        full: `bun add ${name}`,
        command: "bun",
        subcommand: "add",
        package: name,
      });
      break;
    case "deno":
      commands.push({
        full: `deno add npm:${name}`,
        command: "deno",
        subcommand: "add",
        package: `npm:${name}`,
      });
      break;
    case "vlt":
      commands.push({
        full: `vlt install ${name}`,
        command: "vlt",
        subcommand: "install",
        package: name,
      });
      break;
  }

  // Types command if package doesn't have built-in types
  if (!hasTypes) {
    const typesPackage = `@types/${name.replace("@", "").replace("/", "__")}`;
    switch (pm) {
      case "npm":
        commands.push({
          full: `npm install -D ${typesPackage}`,
          command: "npm",
          subcommand: "install",
          flags: "-D",
          package: typesPackage,
          muted: true,
        });
        break;
      case "pnpm":
        commands.push({
          full: `pnpm add -D ${typesPackage}`,
          command: "pnpm",
          subcommand: "add",
          flags: "-D",
          package: typesPackage,
          muted: true,
        });
        break;
      case "yarn":
        commands.push({
          full: `yarn add -D ${typesPackage}`,
          command: "yarn",
          subcommand: "add",
          flags: "-D",
          package: typesPackage,
          muted: true,
        });
        break;
      case "bun":
        commands.push({
          full: `bun add -d ${typesPackage}`,
          command: "bun",
          subcommand: "add",
          flags: "-d",
          package: typesPackage,
          muted: true,
        });
        break;
      case "deno":
        commands.push({
          full: `deno add npm:${typesPackage}`,
          command: "deno",
          subcommand: "add",
          package: `npm:${typesPackage}`,
          muted: true,
        });
        break;
      case "vlt":
        commands.push({
          full: `vlt install -D ${typesPackage}`,
          command: "vlt",
          subcommand: "install",
          flags: "-D",
          package: typesPackage,
          muted: true,
        });
        break;
    }
  }

  return commands;
}
